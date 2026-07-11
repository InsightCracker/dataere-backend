const mongoose = require("mongoose");

const datasetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    originalFilename: { type: String, required: true },

    columns: [
      {
        name: String,
        type: { type: String, enum: ["numeric", "categorical"] },
      },
    ],

    rows: [{ type: mongoose.Schema.Types.Mixed }],

    rowCount: Number,
  },
  { timestamps: true }
);

datasetSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model("Dataset", datasetSchema);