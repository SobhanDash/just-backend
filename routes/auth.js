// Route for user authentication and user details

const express = require("express");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const secret = process.env.JWT_SECRET;

const router = express.Router();

const User = require("../models/User");
const fetchUser = require("../middleware/fetchuser");

// ROUTE-1: Register a user using: POST "/api/auth/register". Doesn't Require Login
router.post(
  "/register",
  [
    body("username", "Enter a valid username").isLength({ min: 5 }),
    body("name", "Enter a valid name").isLength({ min: 3 }),
    body("email", "Enter a valid email").isEmail(),
    body("email", "Enter a valid phone number").isLength({ min: 10 }),
    body("password", "Enter a valid password")
      .isLength({ min: 8 })
      .matches(/^[a-zA-Z0-9!@#$%^&*]{6,16}$/),
  ],
  async (req, res) => {
    let success = false;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      success = false;
      return res.json({ success, errors: errors.array(), status: 400 });
    }
    try {
      let user = await User.findOne({ email: req.body.email, username: req.body.username, phone: req.body.phone });
      if (user) {
        success = false;
        return res.json({
          success,
          error: "This email is associated to another account",
          status: 400,
        });
      }

      let user1 = await User.findOne({ username: req.body.username });
      if (user1) {
        success = false;
        return res.json({
          success,
          error: "This username is already taken",
          status: 400,
        });
      }

      let user2 = await User.findOne({ phone: req.body.phone });
      if (user2) {
        success = false;
        return res.json({
          success,
          error: "This phone is associated to another account",
          status: 400,
        });
      }

      const salt = await bcrypt.genSalt(10);
      const securePassword = await bcrypt.hash(req.body.password, salt);
      user = await User.create({
        username: req.body.username,
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        password: securePassword
      });
      const data = {
        user: {
          id: user.id,
        },
      };
      const authToken = jwt.sign(data, secret);
      success = true;
      res.json({ success, authToken, status: 200 });
    } catch (err) {
        res.send({ error: "Internal Server Error", status: 500 });
    }
  }
);

// ROUTE-2: Login a user using: POST "/api/auth/login". Doesn't Require Login
router.post(
  "/login",
  [
    body("email", "Enter a valid email").isEmail(),
    body("password", "Password cannot be empty").exists(),
  ],
  async (req, res) => {
    let success = false;
    const errors = validationResult(req.body);
    if (!errors.isEmpty()) {
      success = false;
      return res.json({ success, error: errors.array()[0].msg, status: 400 });
    }

    const { email, password } = req.body;
    try {
      let user = await User.findOne({ email });
      if (!user) {
        success = false;
        return res.json({
          success,
          error: "No account is associated to this email, you need to register first",
          status: 400,
        });
      }
      const passwordCompare = await bcrypt.compare(password, user.password);
      if (!passwordCompare) {
        success = false;
        return res.json({
          success,
          error: "Incorrect Password",
          status: 400,
        });
      }
      const data = {
        user: {
          id: user.id,
        },
      };
      const authToken = jwt.sign(data, secret);
      success = true;
      res.json({ success, authToken, status: 200 });
    } catch (err) {
      res.send({ error: "Internal Server Error", status: 500 });
    }
  }
);

// ROUTE-3: Get logged-in user details using: POST "/api/auth/profile". Require Login
router.post("/profile", fetchUser, async (req, res) => {
  let success = false;
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    // user.about.followers.map(async (user1)=> {
    //   const targetUser = await User.findById(user1);
    //   console.log(targetUser.about.posts);
    // });
    // user.about.following.map(async (user1)=> {
    //   const targetUser = await User.findById(user1);
    //   console.log(targetUser.about.posts);
    // });
    success = true;
    res.send({ success, user, status: 200 });
  } catch (error) {
    success = false;
    res.send({ success, error: "Internal Server Error", status: 500 });
  }
});

// ROUTE-4: Add following using: PUT "/api/auth/addfollowing". Require Login
router.put("/addfollowing",[
  body("adduser", "Enter a valid user").exists(),
], fetchUser, async (req, res) => {
  let success = false;
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    const followeduser = await User.findById(req.body.adduser);
    if(!user.following.includes(req.body.adduser)) {
      user.following.push(req.body.adduser);
      const saveduser = await user.save();
      followeduser.followers.push(userId);
      const savedfollower = await followeduser.save();
      success = true;
      res.send({ success, saveduser, status: 200 });
    }
    else {
      success = false;
      res.send({ success, error: "You are already following this user! ", status: 500 });
    }
  } catch (error) {
    success = false;
    res.send({ success, error: "Internal Server Error", status: 500 });
  }
});

// ROUTE-5: Remove following using: PUT "/api/auth/unfollow". Require Login
router.put("/unfollow",[
  body("removeuser", "Enter a valid user").exists(),
], fetchUser, async (req, res) => {
  let success = false;
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    const followeduser = await User.findById(req.body.removeuser);
    if(user.following.includes(req.body.removeuser)) {
      const saveduser = await user.updateOne({ $pull: {following: req.body.removeuser} } )
      const savedfollower = await followeduser.updateOne({ $pull: {followers: userId} } )
      success = true;
      res.send({ success, saveduser, status: 200 });
    }
    else {
      success = false;
      res.send({ success, error: "You are not following this user!", status: 500 });
    }
  } catch (error) {
    success = false;
    res.send({ success, error: error.message, status: 500 });
  }
});

// ROUTE-6: Get user suggestion: GET "/api/auth/getSuggestion". Require Login
router.get("/getSuggestion", fetchUser, async (req, res) => {
  let success = false;
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    const suggestedUsers = [];
    const allUsers = await User.find({});
    allUsers.map(user1=> {
      if(!user.about.following.includes(user1)) {
        suggestedUsers.push(user1);
      }
    });
    return res.json(suggestedUsers);
  } catch (error) {
    success = false;
    res.send({ success, error: "Internal Server Error", status: 500 });
  }
});

module.exports = router;
