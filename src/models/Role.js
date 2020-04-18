import mongoose, { Schema } from "mongoose";

const RoleSchema = new Schema({
    name: String,
    description: String,
    resourceType: { type: String, enum: ["org", "task"] },
    permissions: [String],
    org: { type: Schema.Types.ObjectId, ref: "Org" },
});

mongoose.model("Role", RoleSchema);
