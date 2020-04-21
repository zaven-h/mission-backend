import mongoose from "mongoose";

const { Schema } = mongoose;

const UserSchema = new Schema({
    email: String,
    password: String,
    _jwt_version: { type: Number, default: 0 },
});

mongoose.model("User", UserSchema);
