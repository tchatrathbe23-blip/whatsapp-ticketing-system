import React, { useState } from "react";
import axios from "axios";

export default function AuthFlow({ BACKEND_URL, onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'signup'
  const [authError, setAuthError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password states
  const [forgotStep, setForgotStep] = useState(0); // 0=login, 1=enterEmail, 2=enterOTP, 3=newPassword, 4=success
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotConfirmPass, setForgotConfirmPass] = useState("");
  const [forgotResetToken, setForgotResetToken] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setAuthError("Please enter both email and password.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    setIsLoggingIn(true);
    setAuthError("");
    try {
      const res = await axios.post(`${BACKEND_URL}/login`, { email, password });
      onLoginSuccess(res.data.token);
    } catch (err) {
      setAuthError(err.response?.data?.message || "Invalid email or password. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignup = async () => {
    if (!signupName.trim() || !email.trim() || !password.trim()) {
      setAuthError("Please fill in all fields.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    if (password.length < 4) {
      setAuthError("Password must be at least 4 characters.");
      return;
    }
    setIsLoggingIn(true);
    setAuthError("");
    try {
      const res = await axios.post(`${BACKEND_URL}/register`, {
        name: signupName,
        email,
        password
      });
      onLoginSuccess(res.data.token);
    } catch (err) {
      setAuthError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const switchAuthMode = (mode) => {
    setAuthMode(mode);
    setAuthError("");
    setEmail("");
    setPassword("");
    setSignupName("");
    setShowPassword(false);
  };

  const handleForgotRequest = async () => {
    if (!forgotEmail.trim()) {
      setForgotError("Please enter your email address.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(forgotEmail)) {
      setForgotError("Please enter a valid email address.");
      return;
    }
    setForgotLoading(true);
    setForgotError("");
    try {
      const res = await axios.post(`${BACKEND_URL}/forgot-password`, { email: forgotEmail });
      setForgotMaskedEmail(res.data.maskedEmail);
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!forgotOtp.trim() || forgotOtp.length !== 6) {
      setForgotError("Please enter the 6-digit OTP.");
      return;
    }
    setForgotLoading(true);
    setForgotError("");
    try {
      const res = await axios.post(`${BACKEND_URL}/verify-otp`, { email: forgotEmail, otp: forgotOtp });
      setForgotResetToken(res.data.resetToken);
      setForgotStep(3);
    } catch (err) {
      setForgotError(err.response?.data?.message || "Invalid OTP. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!forgotNewPass.trim()) {
      setForgotError("Please enter a new password.");
      return;
    }
    if (forgotNewPass.length < 4) {
      setForgotError("Password must be at least 4 characters.");
      return;
    }
    if (forgotNewPass !== forgotConfirmPass) {
      setForgotError("Passwords do not match.");
      return;
    }
    setForgotLoading(true);
    setForgotError("");
    try {
      await axios.post(`${BACKEND_URL}/reset-password`, { resetToken: forgotResetToken, newPassword: forgotNewPass });
      setForgotStep(4);
    } catch (err) {
      setForgotError(err.response?.data?.message || "Failed to reset password. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const resetForgotFlow = () => {
    setForgotStep(0);
    setForgotEmail("");
    setForgotMaskedEmail("");
    setForgotOtp("");
    setForgotNewPass("");
    setForgotConfirmPass("");
    setForgotResetToken("");
    setForgotError("");
    setForgotLoading(false);
    setShowNewPassword(false);
  };

  return (
    <div className="login-page">
      {/* ── LEFT BRAND PANEL ── */}
      <div className="login-brand">
        <div className="login-brand-bg">
          <div className="login-shape login-shape-1"></div>
          <div className="login-shape login-shape-2"></div>
          <div className="login-shape login-shape-3"></div>
        </div>
        <div className="login-brand-content">
          <div className="login-brand-logo">
            <div className="logo-icon logo-icon-lg">B</div>
            <span className="login-brand-name">BookingAdmin</span>
          </div>
          <h1 className="login-brand-headline">
            Manage your bookings<br />with confidence
          </h1>
          <p className="login-brand-tagline">
            The all-in-one admin dashboard for tracking reservations,
            revenue, and visitor analytics in real time.
          </p>
          <div className="login-features">
            <div className="login-feature">
              <span className="login-feature-icon">📊</span>
              <div>
                <strong>Real-time Analytics</strong>
                <p>Track bookings and revenue with live charts</p>
              </div>
            </div>
            <div className="login-feature">
              <span className="login-feature-icon">💳</span>
              <div>
                <strong>Integrated Payments</strong>
                <p>Collect payments via Razorpay instantly</p>
              </div>
            </div>
            <div className="login-feature">
              <span className="login-feature-icon">🔒</span>
              <div>
                <strong>Secure & Reliable</strong>
                <p>Enterprise-grade security for your data</p>
              </div>
            </div>
          </div>
          <div className="login-brand-stats">
            <div className="login-brand-stat">
              <span className="login-stat-num">10K+</span>
              <span className="login-stat-label">Bookings Processed</span>
            </div>
            <div className="login-brand-stat">
              <span className="login-stat-num">99.9%</span>
              <span className="login-stat-label">Uptime</span>
            </div>
            <div className="login-brand-stat">
              <span className="login-stat-num">500+</span>
              <span className="login-stat-label">Active Users</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="login-form-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-logo">
            <div className="logo-icon">B</div>
            <span className="logo-text-login">BookingAdmin</span>
          </div>

          {/* ═══ FORGOT PASSWORD FLOW ═══ */}
          {forgotStep > 0 ? (
            <div className="forgot-flow">
              {/* Step indicator */}
              {forgotStep < 4 && (
                <div className="forgot-steps">
                  <div className={`forgot-step-dot ${forgotStep >= 1 ? 'active' : ''}`}>1</div>
                  <div className="forgot-step-line"></div>
                  <div className={`forgot-step-dot ${forgotStep >= 2 ? 'active' : ''}`}>2</div>
                  <div className="forgot-step-line"></div>
                  <div className={`forgot-step-dot ${forgotStep >= 3 ? 'active' : ''}`}>3</div>
                </div>
              )}

              {/* Step 1: Enter email */}
              {forgotStep === 1 && (
                <>
                  <div className="forgot-icon-wrap">🔑</div>
                  <h2 className="login-title">Forgot your password?</h2>
                  <p className="login-subtitle">
                    Enter your email address and we'll send you a verification code.
                  </p>
                  <div className="form-group">
                    <label className="form-label">Email address</label>
                    <div className="input-wrapper">
                      <svg className="input-svg-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                      </svg>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="input-field"
                        placeholder="Enter your email address"
                        onKeyDown={(e) => e.key === "Enter" && handleForgotRequest()}
                        autoFocus
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleForgotRequest}
                    className="login-submit-btn"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <span className="btn-loading"><span className="spinner"></span>Sending...</span>
                    ) : "Send verification code"}
                  </button>
                </>
              )}

              {/* Step 2: Enter OTP */}
              {forgotStep === 2 && (
                <>
                  <div className="forgot-icon-wrap">📧</div>
                  <h2 className="login-title">Check your email</h2>
                  <p className="login-subtitle">
                    We sent a 6-digit verification code to <strong>{forgotMaskedEmail}</strong>. Enter it below.
                  </p>
                  <p className="otp-hint">💡 Check your server console for the OTP</p>
                  <div className="form-group">
                    <label className="form-label">Verification Code</label>
                    <div className="input-wrapper">
                      <svg className="input-svg-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                      </svg>
                      <input
                        type="text"
                        value={forgotOtp}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setForgotOtp(val);
                        }}
                        className="input-field otp-input"
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                        autoFocus
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleVerifyOtp}
                    className="login-submit-btn"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <span className="btn-loading"><span className="spinner"></span>Verifying...</span>
                    ) : "Verify code"}
                  </button>
                  <button className="resend-btn" onClick={handleForgotRequest} disabled={forgotLoading}>
                    Didn't receive it? Resend code
                  </button>
                </>
              )}

              {/* Step 3: New password */}
              {forgotStep === 3 && (
                <>
                  <div className="forgot-icon-wrap">🔐</div>
                  <h2 className="login-title">Create new password</h2>
                  <p className="login-subtitle">
                    Your new password must be at least 4 characters long.
                  </p>
                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <div className="input-wrapper">
                      <svg className="input-svg-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                      </svg>
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={forgotNewPass}
                        onChange={(e) => setForgotNewPass(e.target.value)}
                        className="input-field input-field-password"
                        placeholder="Enter new password"
                        autoFocus
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        tabIndex={-1}
                      >
                        {showNewPassword ? (
                          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                            <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd"/>
                            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm Password</label>
                    <div className="input-wrapper">
                      <svg className="input-svg-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                      </svg>
                      <input
                        type="password"
                        value={forgotConfirmPass}
                        onChange={(e) => setForgotConfirmPass(e.target.value)}
                        className="input-field"
                        placeholder="Confirm new password"
                        onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                      />
                    </div>
                    {forgotNewPass && forgotConfirmPass && forgotNewPass !== forgotConfirmPass && (
                      <p className="field-error">Passwords do not match</p>
                    )}
                  </div>
                  <button
                    onClick={handleResetPassword}
                    className="login-submit-btn"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <span className="btn-loading"><span className="spinner"></span>Resetting...</span>
                    ) : "Reset password"}
                  </button>
                </>
              )}

              {/* Step 4: Success */}
              {forgotStep === 4 && (
                <div className="forgot-success">
                  <div className="success-icon">✅</div>
                  <h2 className="login-title">Password reset successful!</h2>
                  <p className="login-subtitle">
                    Your password has been changed. You can now sign in with your new password.
                  </p>
                  <button onClick={resetForgotFlow} className="login-submit-btn">
                    Back to sign in
                  </button>
                </div>
              )}

              {/* Error display */}
              {forgotError && (
                <div className="error-text">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  {forgotError}
                </div>
              )}

              {/* Back to login link */}
              {forgotStep < 4 && (
                <button className="back-to-login" onClick={resetForgotFlow}>
                  ← Back to sign in
                </button>
              )}
            </div>
          ) : (
            /* ═══ LOGIN / SIGNUP FORMS ═══ */
            <>
              {authMode === "login" ? (
                /* ── LOGIN FORM ── */
                <>
                  <h2 className="login-title">Sign in to your account</h2>
                  <p className="login-subtitle">
                    Enter your credentials to access your dashboard
                  </p>

                  <div className="form-group">
                    <label className="form-label" htmlFor="login-email">Email address</label>
                    <div className="input-wrapper">
                      <svg className="input-svg-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                      </svg>
                      <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-field"
                        placeholder="Enter your email address"
                        autoComplete="email"
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="form-label-row">
                      <label className="form-label" htmlFor="login-pass">Password</label>
                      <button
                        type="button"
                        className="forgot-link"
                        onClick={() => { setForgotStep(1); setAuthError(""); }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="input-wrapper">
                      <svg className="input-svg-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                      </svg>
                      <input
                        id="login-pass"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-field input-field-password"
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                            <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd"/>
                            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="login-options">
                    <label className="remember-me">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="remember-checkbox"
                      />
                      <span className="remember-checkmark"></span>
                      Remember me
                    </label>
                  </div>

                  <button
                    onClick={handleLogin}
                    className="login-submit-btn"
                    disabled={isLoggingIn}
                  >
                    {isLoggingIn ? (
                      <span className="btn-loading">
                        <span className="spinner"></span>
                        Signing in...
                      </span>
                    ) : (
                      "Sign in"
                    )}
                  </button>

                  {authError && (
                    <div className="error-text">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                      </svg>
                      {authError}
                    </div>
                  )}

                  <div className="auth-switch">
                    <span>Don't have an account?</span>
                    <button type="button" onClick={() => switchAuthMode("signup")} className="auth-switch-btn">
                      Create account
                    </button>
                  </div>
                </>
              ) : (
                /* ── SIGNUP FORM ── */
                <>
                  <h2 className="login-title">Create your account</h2>
                  <p className="login-subtitle">
                    Get started with BookingAdmin in seconds
                  </p>

                  <div className="form-group">
                    <label className="form-label" htmlFor="signup-name">Full name</label>
                    <div className="input-wrapper">
                      <svg className="input-svg-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                      </svg>
                      <input
                        id="signup-name"
                        type="text"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        className="input-field"
                        placeholder="Enter your full name"
                        autoComplete="name"
                        onKeyDown={(e) => e.key === "Enter" && handleSignup()}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="signup-email">Email address</label>
                    <div className="input-wrapper">
                      <svg className="input-svg-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                      </svg>
                      <input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-field"
                        placeholder="Enter your email address"
                        autoComplete="email"
                        onKeyDown={(e) => e.key === "Enter" && handleSignup()}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="signup-pass">Password</label>
                    <div className="input-wrapper">
                      <svg className="input-svg-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                      </svg>
                      <input
                        id="signup-pass"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-field input-field-password"
                        placeholder="Create a password (min 4 chars)"
                        autoComplete="new-password"
                        onKeyDown={(e) => e.key === "Enter" && handleSignup()}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                            <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd"/>
                            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleSignup}
                    className="login-submit-btn"
                    disabled={isLoggingIn}
                  >
                    {isLoggingIn ? (
                      <span className="btn-loading">
                        <span className="spinner"></span>
                        Creating account...
                      </span>
                    ) : (
                      "Create account"
                    )}
                  </button>

                  {authError && (
                    <div className="error-text">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                      </svg>
                      {authError}
                    </div>
                  )}

                  <div className="auth-switch">
                    <span>Already have an account?</span>
                    <button type="button" onClick={() => switchAuthMode("login")} className="auth-switch-btn">
                      Sign in
                    </button>
                  </div>
                </>
              )}

              <div className="login-footer">
                <p className="login-footer-text">
                  Protected by enterprise-grade encryption
                </p>
                <div className="login-footer-badges">
                  <span className="footer-badge">🔒 SSL</span>
                  <span className="footer-badge">✓ SOC 2</span>
                  <span className="footer-badge">🛡️ GDPR</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
