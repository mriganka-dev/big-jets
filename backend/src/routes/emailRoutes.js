import express from "express";
import { emailActionLimiter } from "../middlewares/rateLimiters.js";
import {
  showVerifyPage,
  confirmVerifyEmail,
  showUnsubscribePage,
  confirmUnsubscribeEmail,
} from "../controllers/emailController.js";

export const emailRoutes = express.Router();

emailRoutes.get("/email/verify", emailActionLimiter, showVerifyPage);
emailRoutes.post("/email/verify", emailActionLimiter, confirmVerifyEmail);
emailRoutes.get("/email/unsubscribe", emailActionLimiter, showUnsubscribePage);
emailRoutes.post(
  "/email/unsubscribe",
  emailActionLimiter,
  confirmUnsubscribeEmail
);
