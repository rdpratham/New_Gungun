<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/EmployeeModel.php';

requireAdmin();

$errors  = [];
$success = '';
$editing = null;

// Handle POST actions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'create' || $action === 'edit') {
        $data = [
            'employee_code' => trim($_POST['employee_code'] ?? ''),
            'full_name'     => trim($_POST['full_name']     ?? ''),
            'email'         => trim($_POST['email']         ?? ''),
            'department'    => trim($_POST['department']    ?? ''),
            'designation'   => trim($_POST['designation']   ?? ''),
            'mobile'        => trim($_POST['mobile']        ?? ''),
            'join_date'     => $_POST['join_date']          ?? date('Y-m-d'),
            'role'          => $_POST['role']               ?? 'employee',
            'shift_start'   => $_POST['shift_start']        ?? DEFAULT_SHIFT_START,
            'shift_end'     => $_POST['shift_end']          ?? DEFAULT_SHIFT_END,
            'is_active'     => isset($_POST['is_active']) ? 1 : 0,
        ];
        $password = trim($_POST['password'] ?? '');

        if (empty($data['full_name']))  $errors[] = 'Full name is required.';
        if (empty($data['email']))      $errors[] = 'Email is required.';
        if (empty($data['department'])) $errors[] = 'Department is required.';
        if (empty($data['designation']))$errors[] = 'Designation is required.';
        if ($action === 'create' && empty($password)) $errors[] = 'Password is required.';

        if (empty($errors)) {
            if ($action === 'create') {
                $data['employee_code'] = $data['employee_code'] ?: EmployeeModel::nextCode();
                $data['password']      = $password;
                EmployeeModel::create($data);
                flashSet('success', 'Employee added successfully.');
            } else {
                $eid = (int)($_POST['employee_id'] ?? 0);
                if ($password) $data['password'] = $password;
                EmployeeModel::update($eid, $data);
                flashSet('success', 'Employee updated successfully.');
            }
            header('Location: /admin/employees.php');
            exit;
        }
    } elseif ($action === 'delete') {
        $eid = (int)($_POST['employee_id'] ?? 0);
        if ($eid && $eid !== (int)currentEmployee()['employee_id']) {
            EmployeeModel::delete($eid);
            flashSet('success', 'Employee deleted.');
        } else {
            flashSet('danger', 'Cannot delete your own account.');
        }
        header('Location: /admin/employees.php');
        exit;
    }
}

// Load edit target
if (isset($_GET['edit'])) {
    $editing = EmployeeModel::findById((int)$_GET['edit']);
}

$employees   = EmployeeModel::getAll();
$departments = EmployeeModel::getDepartments();
$nextCode    = EmployeeModel::nextCode();

$pageTitle = 'Employees';
include __DIR__ . '/../includes/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-4">
  <h5 class="fw-bold mb-0"><i class="bi bi-people me-2 text-primary"></i>Employee Management</h5>
  <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#empModal">
    <i class="bi bi-plus-lg me-1"></i>Add Employee
  </button>
</div>

<!-- Errors (if modal was open) -->
<?php if (!empty($errors)): ?>
  <div class="alert alert-danger">
    <?php foreach ($errors as $e): ?><div><i class="bi bi-exclamation-circle me-1"></i><?= h($e) ?></div><?php endforeach; ?>
  </div>
<?php endif; ?>

<!-- Table -->
<div class="card shadow-sm">
  <div class="card-body p-0">
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0" id="empTable">
        <thead class="table-light">
          <tr>
            <th>Code</th><th>Name</th><th>Department</th>
            <th>Designation</th><th>Role</th><th>Shift</th>
            <th>Joined</th><th>Status</th><th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($employees as $emp): ?>
          <tr>
            <td class="font-monospace small"><?= h($emp['employee_code']) ?></td>
            <td>
              <div class="fw-semibold"><?= h($emp['full_name']) ?></div>
              <div class="small text-muted"><?= h($emp['email']) ?></div>
            </td>
            <td><?= h($emp['department']) ?></td>
            <td><?= h($emp['designation']) ?></td>
            <td><span class="badge bg-<?= $emp['role'] === 'admin' ? 'danger' : ($emp['role'] === 'hr' ? 'warning' : 'secondary') ?>">
              <?= ucfirst($emp['role']) ?></span></td>
            <td class="small"><?= h($emp['shift_start']) ?>–<?= h($emp['shift_end']) ?></td>
            <td class="small"><?= h($emp['join_date']) ?></td>
            <td>
              <span class="badge bg-<?= $emp['is_active'] ? 'success' : 'secondary' ?>">
                <?= $emp['is_active'] ? 'Active' : 'Inactive' ?>
              </span>
            </td>
            <td class="text-end">
              <a href="?edit=<?= $emp['employee_id'] ?>" class="btn btn-sm btn-outline-primary me-1">
                <i class="bi bi-pencil"></i>
              </a>
              <?php if ($emp['employee_id'] !== (int)currentEmployee()['employee_id']): ?>
              <form method="POST" action="" class="d-inline"
                    onsubmit="return confirm('Delete <?= h(addslashes($emp['full_name'])) ?>?')">
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="employee_id" value="<?= $emp['employee_id'] ?>">
                <button class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button>
              </form>
              <?php endif; ?>
            </td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- Add/Edit Modal -->
<div class="modal fade" id="empModal" tabindex="-1">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <form method="POST" action="">
        <input type="hidden" name="action" value="<?= $editing ? 'edit' : 'create' ?>">
        <?php if ($editing): ?>
          <input type="hidden" name="employee_id" value="<?= $editing['employee_id'] ?>">
        <?php endif; ?>
        <div class="modal-header">
          <h5 class="modal-title fw-bold">
            <i class="bi bi-person-plus me-2"></i><?= $editing ? 'Edit Employee' : 'Add Employee' ?>
          </h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label fw-semibold">Employee Code</label>
              <input type="text" name="employee_code" class="form-control"
                     value="<?= h($editing['employee_code'] ?? $nextCode) ?>"
                     placeholder="Auto-generated" <?= $editing ? 'readonly' : '' ?>>
            </div>
            <div class="col-md-8">
              <label class="form-label fw-semibold">Full Name *</label>
              <input type="text" name="full_name" class="form-control" required
                     value="<?= h($editing['full_name'] ?? '') ?>">
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Email *</label>
              <input type="email" name="email" class="form-control" required
                     value="<?= h($editing['email'] ?? '') ?>">
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Mobile</label>
              <input type="text" name="mobile" class="form-control"
                     value="<?= h($editing['mobile'] ?? '') ?>">
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Department *</label>
              <input type="text" name="department" class="form-control" required list="deptList"
                     value="<?= h($editing['department'] ?? '') ?>">
              <datalist id="deptList">
                <?php foreach ($departments as $d): ?>
                  <option value="<?= h($d) ?>">
                <?php endforeach; ?>
              </datalist>
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Designation *</label>
              <input type="text" name="designation" class="form-control" required
                     value="<?= h($editing['designation'] ?? '') ?>">
            </div>
            <div class="col-md-4">
              <label class="form-label fw-semibold">Role</label>
              <select name="role" class="form-select">
                <?php foreach (['employee','hr','admin'] as $r): ?>
                <option value="<?= $r ?>" <?= ($editing['role'] ?? 'employee') === $r ? 'selected' : '' ?>>
                  <?= ucfirst($r) ?>
                </option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label fw-semibold">Join Date</label>
              <input type="date" name="join_date" class="form-control"
                     value="<?= h($editing['join_date'] ?? date('Y-m-d')) ?>">
            </div>
            <div class="col-md-2">
              <label class="form-label fw-semibold">Shift Start</label>
              <input type="time" name="shift_start" class="form-control"
                     value="<?= h($editing['shift_start'] ?? DEFAULT_SHIFT_START) ?>">
            </div>
            <div class="col-md-2">
              <label class="form-label fw-semibold">Shift End</label>
              <input type="time" name="shift_end" class="form-control"
                     value="<?= h($editing['shift_end'] ?? DEFAULT_SHIFT_END) ?>">
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Password <?= $editing ? '(leave blank to keep)' : '*' ?></label>
              <input type="password" name="password" class="form-control"
                     <?= $editing ? '' : 'required' ?> autocomplete="new-password">
            </div>
            <div class="col-md-6 d-flex align-items-end">
              <div class="form-check">
                <input type="checkbox" name="is_active" class="form-check-input" id="isActiveCheck"
                       <?= ($editing['is_active'] ?? 1) ? 'checked' : '' ?>>
                <label class="form-check-label fw-semibold" for="isActiveCheck">Active Employee</label>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="submit" class="btn btn-primary fw-semibold">
            <i class="bi bi-check-lg me-1"></i><?= $editing ? 'Save Changes' : 'Add Employee' ?>
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

<?php if ($editing || !empty($errors)): ?>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    new bootstrap.Modal(document.getElementById('empModal')).show();
  });
</script>
<?php endif; ?>

<?php include __DIR__ . '/../includes/footer.php'; ?>
