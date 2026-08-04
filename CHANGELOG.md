# Changelog

## Project Sprint 1

- Project proposal (Projektantrag) and project description (Angabe) are available in the `docs` directory.

## Project Sprint 2

- I decided to use Vue.js for the frontend. Then I built the home page with HTML/CSS and mock posts.

## Project Sprint 3a

- I noticed that I need a backend for the project, so I decided to use Express.js for the backend.
- I built a REST API with Express.js and PostgreSQL for the backend. AI helped me a lot with that. I also used AI to build the frontend for the database (for now). I'll redo the frontend later myself.
- I made the `BlogView` and `PostView` pages.

## Project Sprint 3b

- I dockerized the whole application (3 hrs 12 mins).
- I added a CI/CD pipeline (3 hrs 29 mins).
  - Github Actions builds the frontend and backend and pushes the images to Docker Hub.
  - Docker Hub triggers a webhook to the server.
  - The server pulls the new images and restarts the containers. (`updater` container)
  - The server is available behind a reverse proxy (nginx) with SSL.
  - Cookies work now (20 mins)
- I added a document viewer for markdown files and legal documents (1 hr 3 mins)
- I Added better backgrounds (0 hrs 27 mins)
- I added a Slideshow (About page) (0 hrs 21 mins)
- I made the `LoginView` page (will replace the old signup/admin-embedded login pages) (1 hrs 4 mins)

## Project Sprint 4

- I optimized the API (And updated the frontend to use the now API) (2 hrs 5 mins)
- I added a Swagger UI page for the API (0 hrs 56 mins)
- I added User Management and made the new login page replace the old pages (3 hrs 14 mins
)
- I added a new admin page (0 hrs 57 mins)
- I further improved the the website... (1 hrs 57 mins)
- Fix a few other bugs (1 hrs 32 mins)
- Fix the production build (2 hrs 6 mins)

## Overall Time Spent

> around 48 hours
