# EvalAssist

EvalAssist is a lightweight web application built to make evaluation faster and to increase the value of feedback given to learners.

Key points
- This repository moves beyond prior educational projects which were built primarily for learning and experimentation; EvalAssist is focused on delivering a finished, functional product intended for real usage.
- The app is explicitly designed to reduce the workload of evaluators while improving the usefulness of feedback. It helps generate structured, templated comments so evaluators can work faster without sacrificing quality.
- GitHub Copilot was used extensively as a development aid while building the webapp. Design and direction decisions reflect prior experience and domain knowledge; Copilot assisted with implementation and iteration.
- The WebApp is intentionally limited in scope for privacy and compliance reasons:
	- No evaluation responses or generated feedback are stored as part of a learner's educational record. Templates are loaded from local JSON files and in-memory structures; templates and generated comments are not persisted as student records.
	- The app remains largely isolated and does not integrate with grading systems. There are no grades attached to generated feedback.

Why this approach
- Avoiding persistent student records reduces the risk of creating educational records inadvertently and keeps the tool focused on supporting evaluator workflow rather than acting as an LMS component.
- The product balances automation with control: evaluators choose which templates to use and can edit or copy generated feedback before delivering it to learners.

Quick start
1. This webapp is hosted on GitHub Pages for convenient access and distribution. It is intended to be run from that hosted environment, which allows the in-repo `Templates/` files to be fetched correctly.
2. It is also possible to run the app locally by serving the project folder as static files (for example using a simple local HTTP server) — this is useful for development and testing. If running locally, ensure you serve over HTTP so the app can fetch JSON templates from the `Templates/` folder.
3. Open the app (on GitHub Pages or your local server), select a project from the sidebar, and templates will be loaded from `Templates/` when available.

License
This project is released under the terms described in the repository `LICENSE` file.
