const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();
//user registering
app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.send("Password is too short");
    } else {
      const createUserQuery = `
            INSERT INTO 
                user (username, name, password, gender) 
            VALUES 
                (
                '${username}', 
                '${name}',
                '${hashedPassword}', 
                '${gender}'
                )`;
      const dbResponse = await db.run(createUserQuery);
      const newUserId = dbResponse.lastID;
      response.send("User created successfully");
    }
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

//user login
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
//authentication with jwt token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};
//jwtToken:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkpvZUJpZGVuIiwiaWF0IjoxNjUyMDkwMzA2fQ.2RYxmkT89ZPCclCaqJgKphIAryQ3cq4vaa9cj0euB2A

//API3
app.get("/user/tweets/feed", authenticateToken, async (request, response) => {
  let { userId } = request;
  const selectUserQuery = `SELECT * FROM (follower inner join user ON follower.follower_user_id=user.user_id ) as T inner join tweet ON T.following_user_id=tweet.user_id
  WHERE tweet.user_id = '${userId}'`;
  const userDetails = await db.all(selectUserQuery);
  response.send(userDetails);
});

//api4
app.get(
  "/user/following/:userId",
  authenticateToken,
  async (request, response) => {
    let { userId } = request.params;
    const selectUserQuery = `SELECT user.name FROM user inner join follower on user.user_id=follower.following_user_id WHERE follower.follower_user_id = ${userId}`;
    const userDetails = await db.all(selectUserQuery);
    response.send(userDetails);
  }
);

//api5

app.get(
  "/user/followers/:userId",
  authenticateToken,
  async (request, response) => {
    let { userId } = request.params;
    console.log(userId);
    const selectUserQuery = `SELECT user.name FROM user inner join follower on user.user_id=follower.follower_user_id WHERE follower.following_user_id = ${userId}`;
    const userDetails = await db.all(selectUserQuery);
    response.send(userDetails);
  }
);

module.exports = app;
