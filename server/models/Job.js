import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: String, required: true },
    role: { type: String, required: true },
    location: { type: String, default: "Remote" },
    stage: { type: String, default: "Applied" },
    dateApplied: { type: Date, default: Date.now },
    nextStep: { type: String, default: "" },
    notes: { type: String, default: "" },
    deleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model("Job", jobSchema);
