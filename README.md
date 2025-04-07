# DEVOPS IMPLEMENTATION


Make sure to install the TailwindCSS IntelliSense Extension for VSCode [here](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)


# For the backend for Release 1.0
go to appsettings.json and update the DefaultConnection to use your database name, and your configured username and password.
      "DefaultConnection": "server=localhost;database=UserDB;user=root;password=root"

# Create the DB, in this case "UserDB"



## 1. Create the database

CREATE DATABASE IF NOT EXISTS userDB;

## 2. Switch to the new database

USE userDB;

## 3. Create the Users table

CREATE TABLE IF NOT EXISTS Users (
    UserId INT AUTO_INCREMENT,
    Username VARCHAR(255) NOT NULL,
    Password VARCHAR(255) NOT NULL,
    Email VARCHAR(255) NOT NULL,
    ResetToken VARCHAR(255) DEFAULT NULL,
    ResetTokenExpiry DATETIME DEFAULT NULL,
    PRIMARY KEY (UserId)
);

## 4. Create the Notes table

CREATE TABLE IF NOT EXISTS Notes (
    Id CHAR(36) NOT NULL,
    Title VARCHAR(255) NOT NULL,
    Tags VARCHAR(255) NOT NULL,
    UserId INT NOT NULL,
    FilePath VARCHAR(500) NOT NULL,
    OrderValue DOUBLE NOT NULL DEFAULT 0,
    PRIMARY KEY (Id),
    FOREIGN KEY (UserId) REFERENCES Users(UserId)
);

