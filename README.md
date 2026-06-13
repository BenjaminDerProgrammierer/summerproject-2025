# WEBonTour

![Time Tracked Badge](https://wakapi.black2.cf/api/badge/benjamin/interval:all_time/project:summerproject-2025?label=Time%20Tracked)

WEBonTour Blog System

## Usage

There are a few ways to run the project.

### Without Docker

- Install Node.js and pnpm on your machine if you haven't already.
- Use `./generate-secrets.sh` to generate passwords for your environment variables. Only use JWT_SECRET and MASTER_SIGNUP_KEY and manually set them in the server's `.env` file. Check the `.env` file for other required environment variables.
- Use `pnpm install` to install the dependencies for both the frontend and backend.
- Start the backend server with `pnpm dev` (or `pnpm start` for production) in the server directory
- Start the frontend development server with `pnpm dev` (or `pnpm build` -> `pnpm preview` for simulated production) in the client directory.

### With Docker Compose

- Install [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) if you haven't already.
- Use `./generate-secrets.sh` to generate passwords for your environment variables. Check the `.env` file for other required environment variables.
- Run `docker compose -f docker-compose.dev.yml up` to start the development server or `docker compose up -d` instead for the production server.

### Only a database

- Use the `diocker-compose.db.yml` file to only start the database.

## Changelog

### Project Sprint 1

- Project proposal (Projektantrag) and project description (Angabe) are available in the `docs` directory.

### Project Sprint 2

- I decided to use Vue.js for the frontend. Then I built the home page with HTML/CSS and mock posts.

### Project Sprint 3a

- I noticed that I need a backend for the project, so I decided to use Express.js for the backend.
- I built a REST API with Express.js and PostgreSQL for the backend. AI helped me a lot with that. I also used AI to build the frontend for the database (for now). I'll redo the frontend later myself.
- I made the `BlogView` and `PostView` pages.

### Project Sprint 3b

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

### Project Sprint 4

- I optimized the API (And updated the frontend to use the now API) (2 hrs 5 mins)
- I added a Swagger UI page for the API (0 hrs 56 mins)
- I added User Management and made the new login page replace the old pages (3 hrs 14 mins
)
- I added a new admin page (0 hrs 57 mins)
- I further improved the the website... (1 hrs 57 mins)
- Fix a few other bugs (1 hrs 32 mins)
- Fix the production build (2 hrs 6 mins)

### Overall Time Spent

> around 48 hours

## Quick Links

- [Figma File](https://www.figma.com/design/hmDD1XXnwGYYxYCjo0U45Q/Summer-Project-2025)
- [Project Documentation](https://docs.webontour.eu/)
- [Projektantrag](https://docs.webontour.eu/Projektantrag/)
- [Angabe](https://docs.webontour.eu/1JHG-MEDTWT_Sommerprojekt_2425.pdf)
- [Website home on webontour.eu](https://webontour.eu/)
- [GitHub](https://github.com/BenjaminDerProgrammierer/webontour)

## todos

### Optional improvements to do later

#### Really optional, but would be nice to have

- world clock
- weather
- category view - world map layout
- Dark mode
- document editor
- arrow on home back up, not moving all the time
- about page

#### Technical improvements

- Redis session storage

#### Rather important improvements

- pinned posts for the admin

## License

This project is licensed under the GPLv3 (GNU General Public License v3.0). See the [LICENSE](LICENSE) file for details.
