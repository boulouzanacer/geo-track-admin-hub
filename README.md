# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/2904b410-91c5-4f89-a367-7a945f378823

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/2904b410-91c5-4f89-a367-7a945f378823) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/2904b410-91c5-4f89-a367-7a945f378823) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
# vite_react_shadcn_ts

## Database Setup (MySQL)

This project expects three MySQL tables: `clients`, `phones`, and `locations`. If your database only has `clients` or is missing some columns, run the schema script provided.

### 1) Configure `.env`

- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` should point to your MySQL.
- Optional: `API_PORT` for the backend server port.

### 2) Create/align tables

Use the schema file to create tables and add missing columns:

```
mysql -h <host> -P <port> -u <user> -p <database> < server/mysql/schema.sql
```

This will:
- Create `clients` with expected columns if it doesn’t exist.
- Add any missing columns to `clients` (MySQL 8.0+ IF NOT EXISTS).
- Create `phones` and `locations` with proper foreign keys.

### 3) Add an account

Generate a bcrypt hash and insert a client row:

```
node -e "const bcrypt=require('bcryptjs');bcrypt.genSalt(10).then(s=>bcrypt.hash('YourPassword',s)).then(h=>console.log(h))"
```

Then run:

```
INSERT INTO clients (username, password, full_name, email, phone_number, statut, last_login, nbr_phones, expire_date)
VALUES ('demo', '<paste hash here>', 'Demo User', 'demo@example.com', '0000000000', 'active', NOW(), 0, DATE_ADD(CURDATE(), INTERVAL 1 YEAR));
```

### 4) Run servers

```
$env:API_PORT=5002; npm run server
$env:API_PORT=5002; npm run dev
```

Frontend at `http://localhost:8080/`, backend at `http://localhost:5002`.

### Notes
- Login uses `username` from `clients` and verifies bcrypt hashes; if a plaintext password is present, backend falls back to plaintext comparison.
- `/api/auth/me` fetches by `username` from the JWT, avoiding strict reliance on specific PK column names.
