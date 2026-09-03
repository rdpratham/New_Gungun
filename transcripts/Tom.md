# Transcript: Tom

[00:00:00,000] in more detail about what they're going to show. But what you'll see is dashboard capabilities,

[00:00:07,679] a lot of which you can get in Databricks dashboard today, some of which you can't.

[00:00:13,119] And what I like that they're going to show you is the ability to kind of do comparative

[00:00:18,320] model to say this is what you did spend, but our estimate of what you could have spent if you'd

[00:00:23,120] used up in weight models on these workloads would have been this number. And there's like

[00:00:29,440] a confidence indicator of which of those workloads would be the safest and highest

[00:00:35,119] confidence if you'd gone to an open weight model, that type of thing. So

[00:00:40,880] I think that that's good to introduce for your marks. And I will turn over to the people that

[00:00:45,039] will have more interesting things to say. So here's to Monchiu from Short Hills.

[00:00:50,079] Hey, Tom. Happy to connect with you. Thanks, everybody, for the introduction. That, you know,

[00:00:56,000] cause of the majority of the stuff that we're going to talk about is a very good gist of,

[00:01:00,240] you know, the things that we want to introduce to you. So first of all, everything that you see

[00:01:05,280] has been built natively on Databricks. It is passing through the UDAI gate base. And I'll,

[00:01:12,480] I have created a very short slide for you just to give you a very quick roundup.

[00:01:18,480] And I know that you are looking after the data engineering, feature engineering, and, you know,

[00:01:23,760] the auction side of the stuff. Let me know once my screen is come up.

[00:01:33,680] Is it visible?

[00:01:35,760] Oh, yeah.

[00:01:39,680] Okay. Pardon me. I'm just trying to bring it up.

[00:01:54,000] Yeah, I'm sure, in fact, yeah, we did this yesterday.

[00:02:06,719] Oh, okay.

[00:02:11,439] Yeah, Tom, we're not all that fond of Google Meet, but it's, it's the army that we have to take to war.

[00:02:18,639] So, so to speak.

[00:02:24,159] Yeah, yeah.

[00:02:28,080] There we go.

[00:02:32,319] I'm back. I'm really, I'm still getting used to this. So my laptop just crashed up a couple of

[00:02:38,479] times and came back and I had to sit over. So I'm still getting used to the stuff over here.

[00:02:43,360] So pardon me for that.

[00:02:45,759] Can you try sharing once more?

[00:02:48,159] Is it coming through this time?

[00:02:53,599] Yeah, we're getting it. Yeah.

[00:02:56,400] Great. I was scared for a minute over there just, you know,

[00:03:00,960] trying to see if it is showing up properly or not. So let me just walk you through the slides real quick.

[00:03:06,800] There we go.

[00:03:08,080] All right. So I'll give you a very quick roundup of short hills. So we are primarily a

[00:03:12,240] generated firm. We are as

[00:03:16,960] Emory mentioned, we are Databricks partners, we have big builder partners, we have partnered

[00:03:20,319] up with all of the major hyperskaters as well. The major aspect that you want to cover up today is

[00:03:26,560] the dashboard side of the stuff. Hey, you have seen up the consumption that is passing through.

[00:03:31,919] What is the actual

[00:03:35,280] LLMs or the frontier models that you're using right now? So what is, how can you get the

[00:03:41,039] relevant information out of those dashboards? And how can you ensure that you can identify

[00:03:46,080] which different tasks can actually be run by, you know, maybe smaller language model like

[00:03:52,800] a Maverick, if you're using Opus 4.5. And the other solution that Emory briefly mentioned

[00:03:59,120] was about the price lens that we have created. So this primarily looks at, hey, I have a vehicle

[00:04:05,840] listed out on my, you have a vehicle listed out on your website. So how well is it currently priced?

[00:04:13,759] How much of the, we have configured a couple of metrics over there, primarily focusing on

[00:04:20,319] mileage condition and a couple of other things. So what happens when mileage is changed up for a

[00:04:25,759] particular vehicle? Is it priced accordingly? Is it a great deal? For example, 5,995. Is it a great

[00:04:32,959] deal? Yes, it is. Why? Because it is priced 10,244 below the estimated value.

[00:04:39,600] Now, without further ado, I would jump into the solution itself so that you get a good view of the

[00:04:48,480] dashboard. Is it coming through? Yes. All right, cool. So straight out, you can see the

[00:04:58,639] visibility for, I'll focus first on your aspect that you would be looking up more from your

[00:05:06,240] perspective. So over here, I'm looking at what has come through pre-governance and what has come

[00:05:11,600] through after the Nexus IQ governance model has been implemented. What are the active developers

[00:05:16,399] that are currently working or that I have currently deployed on a project? This is on a project

[00:05:20,560] level basis. You can see it on a business unit level bifurcation as well as an individual level

[00:05:26,319] bifurcation. So what is the active developers that are currently using this framework?

[00:05:35,519] On the basis of that, you can even go deeper into it. What is my AI spend daily for the different

[00:05:42,000] developers that are coming through? What is my cost per active developer? What is the total AI

[00:05:47,600] tokens that I have consumed already? How many tool calls that I've made? How many tokens have I

[00:05:52,160] committed right now? Tokens per commit. And what is the cost share for my frontier models? So as of

[00:05:59,360] right now, it is looking at 97.1%. And hey, I have set up a couple of guardrails within Unity AI.

[00:06:07,759] How many have those commits been blocked up because of, hey, maybe a faulty commit, maybe

[00:06:14,079] there were some issues with how the development bent about it? So that sort of visibility can also

[00:06:21,120] be provided to you from within this portal. With me so far, any questions so far?

[00:06:31,040] No, I mean, this is as soon as all traffic would be going through Databricks, correct?

[00:06:35,839] Yeah. Yeah. And I think one of the biggest challenges that we have is that there are

[00:06:41,839] multiple different providers that, and we don't have a single gateway through

[00:06:51,120] Alt AI traffic in LLM calls. We have a co-pilot. We have direct interactions with Anthropik.

[00:07:01,360] And then we have GCP that we get access to Gemini models. So going through Databricks only gives

[00:07:11,120] a small window of what that actual spend would be. So I mean, I think a lot of what you're trying

[00:07:18,879] to track there makes a lot of sense. But what we're trying to do is have that single gateway.

[00:07:25,600] So we can get a multi-service view into where that's being used.

[00:07:32,959] Yeah. That is one of the problems that we have heard a lot coming up. Hey, I have a lot of

[00:07:37,199] different frontier models that I've deployed, but how can I actually really monitor the

[00:07:42,800] consumption or the tokens that I'm spending on all of those different models? So what we have

[00:07:46,399] done is we have, even if you're purchasing it, Claude separately, you can buy, you can pass all

[00:07:52,319] of the traffic or you can route all of the token consumption via the Unity AI gateway so that

[00:07:58,560] everything shows up on this dashboard. And it is pulling up all of that information from the Unity

[00:08:02,720] AI gateway. So even if you purchase it, so it does not matter whether you purchase it via

[00:08:08,800] Databricks Claude route or you purchase it directly via Anthropik, it would still be visible on this

[00:08:13,360] dashboard. So this would give you a single dashboard view for your anti-organization,

[00:08:17,920] as I mentioned, for your business unit level or via your individual consumption level or individual

[00:08:23,040] person level. I'll show this right now itself. So see, this is maybe something that you might

[00:08:36,159] want to take another look at. For example, Amit Kumar, how many sessions has he been operating on?

[00:08:40,799] What is the token statically has consumed? What is the percentage of AI spend that is going through?

[00:08:46,799] How many commits has he made? And what is my cost per commit coming out? So obviously,

[00:08:51,360] this can be customized according to your requirements. But the primary objective that you

[00:08:55,039] might be looking at is, hey, how much of my money am I really burning through for them?

[00:09:00,960] For each of my different developers? And one nifty feature that we believe would be very

[00:09:08,320] interesting for you would be, I'll just scroll down and showcase the point that

[00:09:13,279] Emory had mentioned earlier. So your developers or your internal people would be using maybe different

[00:09:25,279] frontier models, Claude, Opus, you might be using Opus 4.5, you might be using Gemini

[00:09:31,759] 3.1, or you might be using some other model. So what is the work stream that you're actually

[00:09:37,039] using it for? So I'll take a look at this one. For example, hey, I'm creating CI CD pipelines,

[00:09:45,759] or I'm debugging, or I'm creating documents, or I'm creating Word doc files, or I'm adding

[00:09:51,679] certain comments to my existing documentation that I've created for any of the software that

[00:09:57,759] I've created or any of the skills that I have created.

[00:10:00,000] Hey, what is the model that I'm using for this purpose?

[00:10:03,500] This can actually be done by Lama 4, Maverick.

[00:10:07,500] And what you're looking at is actual cost is $1 for this particular commit.

[00:10:15,500] Of course, this is a smaller thing that is coming up,

[00:10:17,500] but this can actually be done by Maverick itself.

[00:10:20,000] And what is the cost thing that you can foresee with this?

[00:10:23,000] It is obviously a smaller value compared to what you can see overall,

[00:10:27,000] because it is a very small use case.

[00:10:28,500] And it is pretty safe to roll up.

[00:10:30,500] I can see this with a high level of confidence.

[00:10:32,500] So what happens is, hey, I'm looking to document

[00:10:36,500] or I'm looking to add different comments for my existing workloads.

[00:10:40,500] So I don't have to leverage Opus 4.5.

[00:10:44,500] It can actually be done by a smaller model if it is fine tuned properly.

[00:10:48,500] And this would significantly bring down your cost for this frontier.

[00:10:52,500] Instead of using this frontier model, you can maybe depend on a smaller model.

[00:10:56,500] So how are you labeling those?

[00:11:00,500] How do you know?

[00:11:01,500] How do you have that introspection into this without giving you the data?

[00:11:06,500] So I'm sorry, you put it in that question, please.

[00:11:08,500] How would you be able to label the work stream without giving it?

[00:11:14,500] How would you identify that?

[00:11:16,500] Where is that happening?

[00:11:19,500] So I'll come down to this particular use case.

[00:11:22,500] So I'm seeing this with a low level of confidence.

[00:11:25,500] So I'll come to the confidence level a little bit later,

[00:11:28,500] but I'll just jump into what we are looking at.

[00:11:31,500] So this is actually created for Epic 4 for this particular project,

[00:11:35,500] Source Connectors.

[00:11:36,500] What I'm doing is I'm creating unit tests for this particular connector.

[00:11:41,500] As of right now, I'm using Opus 4.5.

[00:11:44,500] So this is your current consumption.

[00:11:46,500] So this is a definite value for you, $73.

[00:11:50,500] Right, but how are you identifying that that session is to that information?

[00:11:57,500] Like you have to have the prompts that are being sent to LLM

[00:12:01,500] that you're introspecting and labeling, correct?

[00:12:05,500] Sorry, I missed that piece.

[00:12:07,500] Could you repeat that?

[00:12:08,500] I'm sorry, your voice is a little bit on the software end.

[00:12:11,500] How are you identifying the, and labeling the prompts?

[00:12:16,500] That means that we are passing and you're having to introspect

[00:12:20,500] on the prompts at some level, right?

[00:12:25,500] So that seems like a, to me, a major security concern of ours.

[00:12:35,500] So what will happen is if you're following, you know,

[00:12:41,500] I'm sure you're following a certain level of the ideal security organization.

[00:12:46,500] So you would define up Epic for that and say I'm looking at unit test generation.

[00:12:51,500] So I believe the query that you're looking at is, hey,

[00:12:55,500] how do I actually identify if this is even for a unit test generation?

[00:13:03,500] Is that the question that you're looking at or are you looking at,

[00:13:06,500] hey, would Mavri be a good alternative for it?

[00:13:09,500] No, the upfront.

[00:13:10,500] So like the work stream and what work is in it?

[00:13:13,500] Like how is that being generated?

[00:13:15,500] So what happens is you pass that prompt to Opus.

[00:13:19,500] So at the back end, you will be passing it through the gateway,

[00:13:22,500] your UDI gateway.

[00:13:23,500] At that point of time, this would be locked up within your internal log files.

[00:13:27,500] So what it is doing is actually pulling out those relevant information

[00:13:31,500] and it is just populating a trigger thing.

[00:13:34,500] So this information would be pulled out from your actual commit

[00:13:38,500] study you're making or from your actual prompts that you're generating.

[00:13:43,500] Since you have already integrated the Unity gateway,

[00:13:46,500] that is why we are able to accurately pull it out,

[00:13:49,500] pull this information out that yes, this task was used for unit test generation.

[00:13:55,500] So let me just add some context.

[00:13:57,500] So if it's going through any AI gateway,

[00:14:00,500] it's going to be applying the security model that Unity AI gateway bends out.

[00:14:08,500] So I think that's what Tom is kind of wanting to understand better is

[00:14:13,500] maybe the inferences that you might want to evaluate should not be shared.

[00:14:22,500] Is that where you're getting it, Tom?

[00:14:25,500] Right.

[00:14:26,500] There's a lot of things that are kind of going through there that,

[00:14:31,500] and I know that we, Emery, we have contracts in place between ACV and Databricks.

[00:14:39,500] Yeah.

[00:14:40,500] But that, I don't know, everything is very, very sensitive at ACV around the data that goes out.

[00:14:47,500] It's not just us, dude.

[00:14:49,500] It might be like there might be R&D projects that you don't want to share inside the company.

[00:14:54,500] Right.

[00:14:55,500] So anything that is kind of going through that, like we are asking like all that is zero data retention,

[00:15:01,500] and I don't know how we can potentially even look at this in a zero data retention,

[00:15:06,500] because then you're introspecting the data that's going out through the gateway.

[00:15:12,500] Right.

[00:15:13,500] You see the challenge that we have.

[00:15:14,500] Yeah.

[00:15:15,500] Yeah.

[00:15:16,500] Okay.

[00:15:17,500] So data retention and validation is the P status coming up.

[00:15:21,500] Right.

[00:15:22,500] So like we basically have requirements from our security and legal teams that no other provider can hold on to those prompts or data that are exiting through any sort of gateway.

[00:15:34,500] Okay.

[00:15:35,500] So it seems like if it is going through Unity at Gateway, we can't apply security.

[00:15:43,500] I don't know if this demo is showing that, but I think that that would be something that is available that we could refactor to show.

[00:15:51,500] Right.

[00:15:52,500] But it's showing that there's also some sort of label.

[00:15:55,500] Like it's a raw prompt that's going through.

[00:15:57,500] You can do that in the path through without actually logging it, but you're now assigning some sort of label to that.

[00:16:02,500] And so now there's some other processes coming in and looking at the data that's running through it.

[00:16:07,500] Right.

[00:16:08,500] And unless it's getting it from some other manual process and you're tying it to a Epic or commit or something along those lines to say that this is the data that you're kind of seeing.

[00:16:50,500] Okay.

[00:17:00,500] It's, it's.

[00:17:03,500] So it's not the fact that it's RBAC, but what you just said is that it has to go through another agent and another system to go through.

[00:17:12,500] So that's all that's the piece that is a sticking point for me with any sort of like introspection into the prompts and stuff like that from, and this is just based on requirements that have been established by our security and legal teams.

[00:17:28,500] I do think that what we can do, given that I'm hearing a lot of concern about security and governance.

[00:17:34,500] Tom, we can actually explore the native offering on Databricks.

[00:17:39,500] Now, Daivus doesn't have an out of the box solution that you're seeing here, but we have ways to build on top of the data that's already in your system tables anyway to essentially build out this and you would own the entire end to end workflow where

[00:17:57,500] the thing is going out to like an external agent, you're still in charge of your own data.

[00:18:03,500] And it would just be the additional engineering effort to actually have this visual layer and presentable layer to then actually showcase the same information.

[00:18:13,500] Yeah, so I think the key is there's multiple ways to do this. If we can't show it today, there's a way to refactor, but what I didn't want to gloss over is that if we assume and it sounds like there are ways to do it, that we can solve that problem.

[00:18:29,500] The benefit we wanted to show is the estimated cost savings, which you can see is substantial. And so that's kind of one of the key things I wanted to bring out because I heard Fred express that you're concerned about difficulty in predicting what token usage would be and how to budget for that.

[00:18:45,500] So we can take that back and consider what options would be available to show you that would preserve the security you're talking about, Tom.

[00:18:54,500] Yeah, it makes sense and you know we'll have multiple providers right we're not going to pick one frontier open source, you know, winner to go through.

[00:19:07,500] Yeah, you know, and so you know we are going through our evaluation of different gateway providers and stuff like that.

[00:19:14,500] And different gateway providers have their own method for even just routing up front. You know, even before it's not a post analysis, it's a on the fly analysis of where to route that prompt to which most cost effective option for the task.

[00:19:28,500] Unity AI gateway also has that feature in beta right now we have something called a smart router that takes the input that you're providing to an agent to evaluate which model should this go to for the most cost effective way to get like a reasonable result from the agent.

[00:19:45,500] And so if you're interested in having that as just like a way for you to test things out is it is in beta so we can go and enable it just to play it play around.

[00:19:56,500] Yeah, it might be something we look at, you know, that's some other things kind of.

[00:20:00,000] of flight around that we're trying to manage on the ACV side.

[00:20:03,720] So I'm sorry, Tom, finish your thought.

[00:20:08,079] Yeah, I was just going to say, if it's

[00:20:09,839] enabled in some sort of playground or something along those lines,

[00:20:12,200] that might be something that we could just take into consideration

[00:20:15,440] as we evaluate our options.

[00:20:18,079] Yeah, so the only thing I wanted to show that thought was compelling here

[00:20:21,640] is that while we can predict that there is a lower cost model,

[00:20:27,319] this is trying to address with some credibility,

[00:20:33,319] how much we talk about it.

[00:20:34,559] You say it's less expensive.

[00:20:35,839] Well, can you estimate what that means so that we can budget around that?

[00:20:39,160] And so we have all the pieces out of the box.

[00:20:43,359] It's not built in this way with just the platform.

[00:20:46,880] So.

[00:20:47,880] Yeah, understood.

[00:20:48,799] Yeah, so Tom, this was just meant to give you a bit of visibility

[00:20:52,400] into what can really be done with the leveraging the power of Gini at the back end

[00:20:58,400] and providing, hey, maybe you're not looking at just Lama for Maverick

[00:21:02,440] as a smaller model.

[00:21:03,680] You can even look at DeepSeq.

[00:21:04,880] So we're also comparing it against different models.

[00:21:08,200] What we can do is we can even limit it out.

[00:21:10,000] So if you're interested in only specific models

[00:21:12,359] or if certain models are allowed, for example,

[00:21:15,000] DeepSeq is not really acceptable for a lot of the organizations.

[00:21:20,599] And Lama is also a little bit restricted.

[00:21:22,720] So if you have other models that you are yet, you want to take into consideration.

[00:21:27,000] What we can do is we can replace all those candidates,

[00:21:29,599] specifically for the other models that you want to take into consideration.

[00:21:33,960] And we can provide an estimated cost.

[00:21:36,440] Hey, what would it look like to generate this particular work stream

[00:21:42,440] using that particular smaller model?

[00:21:45,160] And what would the estimated cost really look like?

[00:21:48,759] And what would be the risk-adjusted saving?

[00:21:50,720] So the risk-adjusted saving we are considering is considering that,

[00:21:54,240] hey, this is a little bit of a complicated task.

[00:21:56,880] Lama might require a little bit of fine-tuning to take that

[00:22:00,480] into production in a very short time frame.

[00:22:03,000] But for a medium complexity or for a low complexity task,

[00:22:09,480] which we can save with a high level of confidence,

[00:22:11,240] hey, it is very easy to port it over to a smaller model

[00:22:14,480] and you can see immediate cost savings over there.

[00:22:18,079] Yeah, I mean, it makes a lot of sense.

[00:22:19,599] I mean, I think everyone is being token conscious these days with...

[00:22:23,279] Yeah, this definitely is a good question.

[00:22:25,240] And where everything is kind of going from that standpoint,

[00:22:28,079] you don't need Fable 5 to go and crush a unit-test generation task.

[00:22:33,079] Exactly.

[00:22:34,079] Tell me about it.

[00:22:38,079] So yeah, this is one of the key features that you wanted to really go through.

[00:22:42,079] And of course, the other aspect that I covered up that might be relevant for you,

[00:22:46,079] the token consumption model that you just mentioned,

[00:22:49,079] hey, what is the total tokens that have been consumed up

[00:22:52,079] that you can see in a single way, in a single dashboard view.

[00:22:56,079] So we can have those all customized over here.

[00:23:00,079] The other piece that you were even considering was,

[00:23:03,079] hey, what is the level of fine-tuning that I can do?

[00:23:06,079] How many people can I really give access to?

[00:23:08,079] Because I believe this is one thing that you were even considering.

[00:23:10,079] Hey, I don't want to give, for example, if I'm working in your organization,

[00:23:14,079] maybe I don't need to get access to the different projects that you're working on.

[00:23:18,079] Maybe I just need access to the AMGT project.

[00:23:21,079] So I would have only access to this particular project,

[00:23:23,079] and I can see only limited amount of information,

[00:23:26,079] which are permitted by maybe whoever is the admin of that particular application

[00:23:34,079] or development engagement.

[00:23:36,079] So you can have a little bit of a piece of mind, hey,

[00:23:40,079] for example, Himachal would not be able to see the application

[00:23:44,079] which is being generated by Pratham's team.

[00:23:47,079] And Pratham would similarly not be able to see what I am developing

[00:23:52,079] or what is the token consumption that I'm pushing through.

[00:23:58,079] Does this sort of, or did I completely lose the over there?

[00:24:02,079] Yeah, I mean, it makes sense, right?

[00:24:04,079] Like you're just trying to do governance

[00:24:06,079] and not giving everyone access to everyone's token usage

[00:24:09,079] and spend, which makes a lot of sense.

[00:24:14,079] Yeah, and that's something that we right now just kind of,

[00:24:18,079] everyone access to everyone, but there's other ways to kind of restrict that

[00:24:22,079] for what we have.

[00:24:24,079] But we're still kind of an infancy of tracking all our token costs

[00:24:28,079] across all the different providers.

[00:24:32,079] So, Tom, if you don't mind me asking this,

[00:24:35,079] so how are you actually looking at this sort of thing?

[00:24:38,079] Are you looking at a single unified dashboard right now

[00:24:41,079] or are you looking for a little bit more of a deeper dive

[00:24:45,079] into an individual level work stream breakdown?

[00:24:49,079] What is the functionality that you are visualizing right now?

[00:24:54,079] I mean, right now we are still just, I mean,

[00:24:58,079] we're pulling a lot of our data into our data warehouse

[00:25:02,079] and presenting through that way.

[00:25:04,079] So we're getting a lot of our, we're combining all our different spend

[00:25:09,079] into the data warehouse and then combining that with our developer productivity metrics.

[00:25:13,079] So it ends up being through the dashboards that we have a lot of access into.

[00:25:20,079] Token uses, tickets, get out commits, all of that that we have

[00:25:25,079] at an individual user level, plus, you know, the projects that, you know,

[00:25:29,079] so it's not just users, but it's also projects as well.

[00:25:34,079] And each one kind of provides different levels of fidelity to, you know,

[00:25:37,079] certain ones like co-pilot, they don't return cost information.

[00:25:42,079] You only get token usage.

[00:25:44,079] So, you know, it's a data engineering exercise at the end of the day with some of that.

[00:25:50,079] I'm not as involved with that anymore.

[00:25:54,079] I'm more on the, we are building AI solutions around these

[00:25:59,079] and so focused on more the software engineering aspect

[00:26:04,079] and doing the AI engineering is more what my team's been around.

[00:26:08,079] I'm stepping away from a little bit of like the actual gateway work and implementation

[00:26:13,079] and that as like a shared service.

[00:26:17,079] Got it.

[00:26:19,079] So, Emily, do we want to go through price lens as well or should we focus on this?

[00:26:26,079] Because I believe there is a little bit of Tom just for your reference.

[00:26:30,079] There is also the visibility that you might want to get into.

[00:26:33,079] Hey, what is the Databricks utilization and, you know, the server, the AWS,

[00:26:40,079] as a whole, you might be on, you might be on an AWS environment

[00:26:43,079] or you might be on Azure environment.

[00:26:45,079] You might also want to take a look at, hey, what is the different as your services

[00:26:49,079] that I'm currently utilizing as of right now?

[00:26:51,079] And what is the cost that is coming through for that?

[00:26:54,079] So if you want to have that visibility, I think we take that into this one particular as well.

[00:26:59,079] So is that something that's interesting for you or?

[00:27:03,079] I think, I mean, we get a lot of those metrics through Datadog.

[00:27:07,079] So we have all our, we have a Datadog integrations into all our services.

[00:27:11,079] So we got all our spend for compute and stuff like that through there.

[00:27:16,079] Got it.

[00:27:17,079] So I believe this would be more relevant for the AI consumption value metrics.

[00:27:22,079] Yeah.

[00:27:25,079] Tom, is there, you know, something where if, if what you saw had X additional features that would make that more compelling and timely for what ACV needs today,

[00:27:41,079] that we could, we could consider, you know, options and kind of a, you know, coming back to you with something that is more tailored?

[00:27:49,079] I think it's, I don't know, we're still going back and forth.

[00:27:57,079] There's security on the other team and a final set of requirements of what we want to see.

[00:28:00,079] Like we built our own in-house LLM gateway.

[00:28:03,079] Yeah.

[00:28:04,079] And, you know, we're looking to see, do we want to continue investing in that or switch to, you know, a more enterprise solution.

[00:28:11,079] It still doesn't change the fact that we have multiple different ways to go through LLM providers.

[00:28:19,079] So there's a governance issue, no matter what you choose.

[00:28:22,079] Right.

[00:28:23,079] Yeah.

[00:28:24,079] And it's not just governance.

[00:28:28,079] There are just additional requests that about data and data privacy and things like that.

[00:28:38,079] And I don't necessarily think of it as a data residency.

[00:28:42,079] And I guess it's kind of governance, but it's like where, where does that reside and things like that.

[00:28:47,079] Yeah.

[00:28:48,079] I guess I was just thinking that there might be like swim lanes where if the developer is going to use an LLM,

[00:28:57,079] those ground rules that they have to follow to, you know, configure it this way.

[00:29:01,079] Here's the end points that you use.

[00:29:04,079] Here's how it works.

[00:29:05,079] That's, that's what I'm thinking about.

[00:29:06,079] And I'm not, I'm not trying to think of governance specifically as, you know, governance doesn't equal one to one,

[00:29:13,079] you know, the gateway or gateway.

[00:29:15,079] I'm thinking more broadly about people in process than, than technology specifically.

[00:29:20,079] So it covers a lot.

[00:29:24,079] Yeah, understood.

[00:29:25,079] Yeah.

[00:29:28,079] Okay.

[00:29:29,079] So the other demo that Short Hills had, we don't have time for it today,

[00:29:35,079] but it's, it's a beautiful rendering of a way to, to identify optimal cost for aftermarket vehicles or resell vehicles.

[00:29:46,079] And this is something that Short Hills actually did for another, another customer.

[00:29:52,079] I don't know if it's of interest to your team, but it seems relevant.

[00:29:58,079] So if you look at ACVs kind of.

[00:30:00,000] goal and trajectory to be the trusted voice in accurate pricing for for resale vehicles.

[00:30:06,640] It seemed like a relevant solution to show to ACV. So is that something that you'd be interested

[00:30:13,119] in or would there be a colleague that would be better suited to look at something like that?

[00:30:17,200] Yeah, probably me, Fred and Jordan again on that piece. I do own our pricing APIs and models that

[00:30:26,880] we've built. We have a ton of third party providers and a lot that you've probably even heard of

[00:30:33,039] that we've integrated with for those. We're not as big of a name as are the Cali Blue

[00:30:40,799] Books and JD Powers, but we are just as accurate as they are with what we have.

[00:30:47,599] But yeah, I mean there's. And so we've done work for Edmunds, we've done work for Cox,

[00:30:53,599] and then Short Hills has done some work for other other providers too. So it just seemed like

[00:30:57,680] it's some synergies that would be worth having a look at. And so would that be something we'd want

[00:31:04,559] to see if we could arrange for the three of you again to do a follow on demo on that piece of

[00:31:10,400] technology? Yeah, I mean I'm interested to see what you guys have to offer around that.

[00:31:17,440] We're pretty mature in our pricing and pricing capabilities and what we present.

[00:31:22,319] But I'm not going to say that I know it all.

[00:31:26,880] I don't know where the delineation point is, but there's the accuracy and pricing and then

[00:31:35,359] there's the way it's presented. And I think this is maybe at the intersection of some of those things

[00:31:39,599] too. So anyway, if you're game, I will propose a time when we can come back and hopefully Jordan

[00:31:48,480] and Fred could join us that time and we'll see what that gets. Okay, sounds good. All right.

[00:31:56,960] Brossum, Amanchu, appreciate the demo. I definitely think where you're heading, it makes a lot of

[00:32:02,960] sense. No, I just hope that it made sense for you as an individual. Hey, this is actually

[00:32:09,759] making sense for you as an organization, as an individual. That is, it is able to provide you

[00:32:13,599] with the relevant information that you were looking for. So as to say, and you're at least

[00:32:18,640] able to come out of it with a little bit more clarity about how you can visualize your AI gateway

[00:32:25,039] integration. Yeah, I think the labeling and all that and how usage is very interesting. Obviously,

[00:32:34,960] we're looking at propelling spend and a lot of it is just proving out how to show that in these

[00:32:41,519] situations you need to do it. So the more the shift left paradigm, the more you can do that up front

[00:32:47,279] and do the better rather than being reactive to it. So I see that people just see a bill,

[00:32:54,000] what you're doing is still a little bit earlier in that it's a little reactive. You're saying,

[00:32:58,640] okay, these are the tasks I can do it, but then getting that routing and everything else up front

[00:33:03,039] is like to me, where things will be a much bigger game change for capabilities. That's a good point.

[00:33:11,680] So.

[00:33:12,799] Got it. I've made a note of that.

[00:33:18,160] All right. Just one more thing, every few will permit me. I know I'm meeting with the time.

[00:33:25,440] So Tom, just to give you a quick background into it as well. So this particular solution,

[00:33:29,599] how it will happen is it will be deployed in your environment. So the sort of customization

[00:33:33,920] that you would be looking at, hey, I'm a little bit worried about what is the sort of information

[00:33:38,000] that would be really passed off to a third party. I would not be getting any sort of information

[00:33:42,000] since it's hosted in your particular service. And since you're passing it through Databricks,

[00:33:47,759] and you can decide on which projects are supposed to be really integrated into it. So you can

[00:33:53,359] control how much of the governance level that you have to really take up.

[00:33:59,119] Yeah, makes sense. I mean, we still have to even just have security review the gateway

[00:34:04,720] and what you have from that standpoint. So, you know, as we're kind of going through that,

[00:34:09,440] like that's kind of step one in my mind. Yeah, whenever you guys are ready, I'll be the funny

[00:34:14,960] contact review passing information. Yeah, we're like I said, we're still trying to finalize requirements

[00:34:20,960] there. So you got it.

[00:34:33,920] So, how are you labeling the prompts each time they go through?

[00:35:03,920] So, how is that being done? And like you're running some sort of ML model to label them?

[00:35:34,000] So, it doesn't retain the prompt, how do you label it?

[00:35:45,840] So, what is looking at the problem is, hey, I don't want to give or I don't want to retain

[00:35:50,800] those prompts. So, how would you label them up? Let me come back to you with this particular.

[00:35:57,760] Yeah, let's discuss that and try and talk about options.

[00:36:01,840] Okay, sounds good. All right. Thank you every time, Tom, as always, I appreciate it.

[00:36:09,199] We'll look for time to schedule the other demo and we'll see you then.

[00:36:12,960] Sounds good. Okay, thanks again. Bye-bye.

