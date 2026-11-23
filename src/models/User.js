import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const ALLOWED_THEMES = [
    "industrial-forge",
    "cyber-circuit",
    "cobalt-blueprint",
    "sovereign-vault",
    "acid-reactor",
];

export const DEFAULT_THEME_ID = "industrial-forge";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: function () { return !this.googleId; }
    },
    googleId: {
        type: String,
        default: null
    },
    avatar: {
        type: String,
        default: ""
    },
    monthlyBudget: {
        type: Number,
        default: 50000
    },
    alertThreshold: {
        type: String,
        enum: ["75%", "80%", "90%"],
        default: "80%"
    },
    themeId: {
        type: String,
        enum: ALLOWED_THEMES,
        default: DEFAULT_THEME_ID
    }
}, { timestamps: true });

// Sirf async function use karein, next() parameter hata dein
userSchema.pre('save', async function () {
    // Agar password naya nahi hai ya change nahi hua hai, toh execution wahin rok dein
    if (!this.isModified('password') || !this.password) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', userSchema);