"""Core job processing logic — runs OCR pipeline for a submitted job."""
from __future__ import annotations

import datetime
import json
import traceback
from pathlib import Path

import yaml
from PIL import Image
from sqlalchemy.orm import Session

from api.database import Job, JobStatus, SessionLocal
from api.settings import settings
from pipeline import ingestion, preprocessing, validation, output_builder
from pipeline.ocr_engine import OCREngine


def _load_config() -> dict:
    with open(settings.thresholds_config) as f:
        return yaml.safe_load(f)


def _get_ocr_engine(cfg: dict) -> OCREngine:
    ocr_cfg = cfg.get("ocr", {})
    return OCREngine.get_instance(
        languages=ocr_cfg.get("languages", ["en"]),
        gpu=ocr_cfg.get("gpu", False),
        model_storage_directory=str(settings.models_dir),
    )


def process_job(job_id: str) -> None:
    """Main processing entry point — called by Celery task or inline thread."""
    db: Session = SessionLocal()
    try:
        job: Job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return

        job.status = JobStatus.processing
        job.updated_at = datetime.datetime.utcnow()
        db.commit()

        cfg = _load_config()
        ocr_engine = _get_ocr_engine(cfg)
        dictionary = validation.load_dictionary(settings.dictionary_path)

        upload_path = Path(job.upload_path)
        file_data = upload_path.read_bytes()
        ftype = job.file_type

        pre_cfg = cfg.get("preprocessing", {})
        stages = pre_cfg.get("enabled_stages", {})
        save_debug = pre_cfg.get("save_debug_thumbnails", False)
        confidence_threshold = cfg.get("ocr", {}).get("confidence_threshold", 0.85)
        fuzzy_threshold = cfg.get("validation", {}).get("fuzzy_match_threshold", 80)

        page_results: list[dict] = []
        all_needs_review: list[dict] = []

        if ftype == "pdf":
            if ingestion.has_text_layer(
                file_data, cfg.get("pdf", {}).get("text_layer_min_chars", 10)
            ):
                pages = ingestion.extract_pdf_text_layer(file_data)
                for p in pages:
                    p["source"] = "text_layer"
                    p["needs_review"] = []
                    entities = validation.extract_entities(p["full_text"] if "full_text" in p else " ".join(l["text"] for l in p["lines"]))
                    p["entities"] = entities
                    p["full_text"] = "\n".join(l["text"] for l in p["lines"])
                page_results = pages
            else:
                rendered = ingestion.render_pdf_pages(
                    file_data, dpi=cfg.get("pdf", {}).get("render_dpi", 300)
                )
                job.page_count = len(rendered)
                db.commit()

                for rendered_page in rendered:
                    img = rendered_page["image"]
                    pg_num = rendered_page["page_number"]
                    page_results.append(
                        _process_image_page(
                            img, pg_num, ocr_engine, stages, save_debug,
                            confidence_threshold, fuzzy_threshold, dictionary,
                            job_id, cfg,
                        )
                    )

        else:  # jpeg/png
            img = ingestion.load_image(file_data)
            job.page_count = 1
            db.commit()
            page_results.append(
                _process_image_page(
                    img, 1, ocr_engine, stages, save_debug,
                    confidence_threshold, fuzzy_threshold, dictionary,
                    job_id, cfg,
                )
            )

        # Collect needs_review across all pages
        for p in page_results:
            for r in p.get("needs_review", []):
                all_needs_review.append({"page": p["page_number"], **r})

        result = output_builder.build_json_result(job_id, page_results)
        result["needs_review"] = all_needs_review

        # Write outputs
        out_dir = settings.output_dir / job_id
        out_dir.mkdir(parents=True, exist_ok=True)

        json_path = out_dir / "result.json"
        output_builder.write_json(result, json_path)
        output_builder.write_txt(page_results, out_dir / "result.txt")

        job.result_path = str(json_path)
        job.status = JobStatus.completed
        job.completed_at = datetime.datetime.utcnow()
        job.updated_at = datetime.datetime.utcnow()
        db.commit()

    except Exception as exc:
        tb = traceback.format_exc()
        db.query(Job).filter(Job.id == job_id).update({
            "status": JobStatus.failed,
            "error_message": f"{exc}\n{tb}",
            "updated_at": datetime.datetime.utcnow(),
        })
        db.commit()
    finally:
        db.close()


def _process_image_page(
    img: Image.Image,
    page_number: int,
    ocr_engine: OCREngine,
    stages: dict,
    save_debug: bool,
    confidence_threshold: float,
    fuzzy_threshold: int,
    dictionary: list[str],
    job_id: str,
    cfg: dict,
) -> dict:
    debug_prefix = ""
    if save_debug:
        debug_dir = settings.debug_thumbnails_dir / job_id
        debug_dir.mkdir(parents=True, exist_ok=True)
        debug_prefix = str(debug_dir / f"page_{page_number}")

    processed_img, stage_info = preprocessing.preprocess(
        img, stages=stages, save_debug=save_debug, debug_prefix=debug_prefix
    )

    regions = ocr_engine.read_image(processed_img)
    regions = validation.sort_by_reading_order(regions)
    regions = validation.apply_fuzzy_correction(regions, dictionary, fuzzy_threshold)
    ok_regions, review_regions = validation.flag_low_confidence(regions, confidence_threshold)

    full_text = validation.build_page_text(regions)
    entities = validation.extract_entities(full_text)

    return {
        "page_number": page_number,
        "source": "ocr",
        "regions": regions,
        "needs_review": review_regions,
        "full_text": full_text,
        "entities": entities,
        "preprocessing": stage_info,
        "image": img,
    }
