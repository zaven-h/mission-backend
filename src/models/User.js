import mongoose from "mongoose";

const { Schema } = mongoose;

const UserSchema = new Schema({
    email: String,
    password: String,
});

mongoose.model("User", UserSchema);
