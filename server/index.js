import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Job from "./models/Job.js";
import Task from "./models/Task.js";
import User from "./models/User.js";

const app = express();
const port = process.env.PORT || 5000;
const jwtSecret = process.env.JWT_SECRET;
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!jwtSecret) {
  throw new Error("JWT_SECRET must be configured before starting the API.");
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Origin is not allowed by CORS."));
  }
}));
app.use(express.json({ limit: "100kb" }));

const makeToken = (user) => jwt.sign(
  { id: user._id.toString(), name: user.name },
  jwtSecret,
  { expiresIn: "7d" }
);

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Authentication required." });
  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    res.status(401).json({ message: "Your session has expired. Please log in again." });
  }
}

const pick = (body, fields) => Object.fromEntries(fields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
const jobFields = ["company", "role", "location", "stage", "nextStep", "notes", "deleted"];
const taskFields = ["title", "category", "dueDate", "priority", "completed", "deleted"];

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!name || !email || password.length < 6) return res.status(400).json({ message: "Use a name, valid email, and password with at least 6 characters." });
    if (await User.findOne({ email })) return res.status(409).json({ message: "That email is already registered." });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 12) });
    res.status(201).json({ token: makeToken(user), user: { name: user.name, email: user.email } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(String(req.body.password || ""), user.password))) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }
    res.json({ token: makeToken(user), user: { name: user.name, email: user.email } });
  } catch (error) {
    next(error);
  }
});

app.use("/api/jobs", requireAuth);
app.get("/api/jobs", async (req, res, next) => {
  try { res.json(await Job.find({ user: req.user.id }).sort({ createdAt: -1 })); } catch (error) { next(error); }
});
app.post("/api/jobs", async (req, res, next) => {
  try { res.status(201).json(await Job.create({ ...req.body, user: req.user.id })); } catch (error) { next(error); }
});
app.patch("/api/jobs/:id", async (req, res, next) => {
  try {
    const job = await Job.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, pick(req.body, jobFields), { new: true, runValidators: true });
    if (!job) return res.status(404).json({ message: "Job not found." });
    res.json(job);
  } catch (error) { next(error); }
});
app.delete("/api/jobs/:id", async (req, res, next) => {
  try {
    const job = await Job.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { deleted: true }, { new: true });
    if (!job) return res.status(404).json({ message: "Job not found." });
    res.json(job);
  } catch (error) { next(error); }
});

app.use("/api/tasks", requireAuth);
app.get("/api/tasks", async (req, res, next) => {
  try { res.json(await Task.find({ user: req.user.id }).sort({ completed: 1, dueDate: 1 })); } catch (error) { next(error); }
});
app.post("/api/tasks", async (req, res, next) => {
  try { res.status(201).json(await Task.create({ ...req.body, user: req.user.id })); } catch (error) { next(error); }
});
app.patch("/api/tasks/:id", async (req, res, next) => {
  try {
    const task = await Task.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, pick(req.body, taskFields), { new: true, runValidators: true });
    if (!task) return res.status(404).json({ message: "Task not found." });
    res.json(task);
  } catch (error) { next(error); }
});
app.delete("/api/tasks/:id", async (req, res, next) => {
  try {
    const task = await Task.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { deleted: true }, { new: true });
    if (!task) return res.status(404).json({ message: "Task not found." });
    res.json(task);
  } catch (error) { next(error); }
});

app.use((error, _, res, __) => {
  console.error(error);
  res.status(500).json({ message: "The server could not complete that request." });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => app.listen(port, () => console.log(`API ready on port ${port}`)))
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
