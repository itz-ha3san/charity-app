import{pool}from"./db.js";import{runMigrations}from"./migrations.js";try{await runMigrations(pool)}finally{await pool.end()}
