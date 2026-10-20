import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  GraduationCap,
  ImagePlus,
  KeyRound,
  LoaderCircle,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { api } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { formatDate } from "../utils/format.js";
import SectionHeading from "../components/SectionHeading.jsx";

const initialPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};
const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function ProfilePage() {
  const { user, logout, refresh } = useAuth();
  const photoInputRef = useRef(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoSuccess, setPhotoSuccess] = useState("");
  const [name, setName] = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState("");
  const [passwordForm, setPasswordForm] = useState(initialPasswordForm);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    setName(user?.name || "");
  }, [user?.name]);

  const saveName = async (event) => {
    event.preventDefault();
    setNameError("");
    setNameSuccess("");
    setSavingName(true);
    try {
      await api.patch("/auth/profile", { name });
      await refresh();
      setNameSuccess("Your name has been updated.");
    } catch (error) {
      setNameError(error.message);
    } finally {
      setSavingName(false);
    }
  };

  const uploadPhoto = async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setPhotoError("");
    setPhotoSuccess("");
    if (!PROFILE_PHOTO_TYPES.has(file.type)) {
      setPhotoError("Choose a JPEG, PNG, or WebP image.");
      event.currentTarget.value = "";
      return;
    }
    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      setPhotoError("Profile photos must be 5 MB or smaller.");
      event.currentTarget.value = "";
      return;
    }
    const formData = new FormData();
    formData.append("photo", file);
    setPhotoBusy(true);
    try {
      await api.upload("/auth/profile/photo", formData);
      await refresh();
      setPhotoSuccess("Your profile photo has been updated.");
    } catch (error) {
      setPhotoError(error.message);
    } finally {
      setPhotoBusy(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const removePhoto = async () => {
    setPhotoError("");
    setPhotoSuccess("");
    setPhotoBusy(true);
    try {
      await api.delete("/auth/profile/photo");
      await refresh();
      setPhotoSuccess("Your profile photo has been removed.");
    } catch (error) {
      setPhotoError(error.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  const updatePasswordField = (event) =>
    setPasswordForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      const result = await api.patch("/auth/password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm(initialPasswordForm);
      setPasswordSuccess(result.message || "Password updated.");
    } catch (error) {
      setPasswordError(error.message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="profile-page">
      <SectionHeading
        eyebrow="ACCOUNT SETTINGS"
        title="Your profile"
        description="Review your saved details, add a profile photo, edit your name, or update your password."
      />
      <div className="profile-layout">
        <section className="profile-card surface-card">
          <button
            className="profile-avatar-wrap profile-avatar-button"
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={photoBusy}
            aria-label={
              user?.profilePhotoUrl
                ? "Change profile photo"
                : "Upload profile photo"
            }
            title={
              user?.profilePhotoUrl
                ? "Change profile photo"
                : "Upload profile photo"
            }
          >
            {user?.profilePhotoUrl ? (
              <img
                className="profile-avatar-image"
                src={user.profilePhotoUrl}
                alt=""
              />
            ) : (
              <span className="profile-avatar" aria-hidden="true">
                {user?.name?.slice(0, 1)?.toUpperCase()}
              </span>
            )}
          </button>
          <h2>{user?.name}</h2>
          <div className="profile-photo-tools">
            <input
              ref={photoInputRef}
              className="profile-photo-input"
              id="profile-photo-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={uploadPhoto}
              aria-label="Choose a profile photo"
            />
            <div className="profile-photo-actions">
              <button
                className="button button-outline"
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoBusy}
              >
                {photoBusy ? (
                  <LoaderCircle size={15} className="icon-spin" />
                ) : (
                  <ImagePlus size={15} />
                )}
                {photoBusy
                  ? "Saving…"
                  : user?.profilePhotoUrl
                    ? "Change photo"
                    : "Upload photo"}
              </button>
              {user?.profilePhotoUrl && (
                <button
                  className="button button-text-danger"
                  type="button"
                  onClick={removePhoto}
                  disabled={photoBusy}
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              )}
            </div>
            <small className="profile-photo-help">
              JPEG, PNG, or WebP · up to 5 MB
            </small>
            {photoError && (
              <p className="profile-form-message is-error" role="alert">
                {photoError}
              </p>
            )}
            {photoSuccess && (
              <p className="profile-form-message is-success" role="status">
                <CheckCircle2 size={14} />
                {photoSuccess}
              </p>
            )}
          </div>
          <span className="role-badge">
            <UserRound size={14} /> Student
          </span>
          <p>
            Your identity is used for course progress and activity reporting.
          </p>
          <button className="button button-outline" onClick={logout}>
            <LogOut size={15} /> Sign out
          </button>
        </section>
        <section className="profile-details surface-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">ACCOUNT DETAILS</span>
              <h2>Profile information</h2>
            </div>
          </div>
          <ProfileItem icon={Mail} label="Email address" value={user?.email} />
          <ProfileItem
            icon={Fingerprint}
            label="Student ID"
            value={user?.studentId}
          />
          <ProfileItem
            icon={GraduationCap}
            label="Semester / class"
            value={
              user?.semester
                ? `Semester ${user.semester} · Class ${user.classSection || "—"}`
                : "Not set"
            }
          />
          <ProfileItem
            icon={Award}
            label="Points earned"
            value={`${(user?.totalPoints || 0).toLocaleString()} points`}
          />
          <ProfileItem
            icon={CalendarDays}
            label="Account created"
            value={formatDate(user?.createdAt, { time: false })}
          />
          <div className="profile-security-note">
            <ShieldCheck size={16} />
            <span>
              Passwords are hashed on the server and are never shown in your
              profile.
            </span>
          </div>
        </section>
      </div>

      <div className="profile-action-grid">
        <section className="surface-card profile-action-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">PERSONAL DETAILS</span>
              <h2>Edit your name</h2>
            </div>
            <UserRound size={19} className="muted-icon" />
          </div>
          <p className="profile-form-description">
            Change the name shown in your student workspace and reports.
          </p>
          <form className="profile-form" onSubmit={saveName}>
            <label htmlFor="profile-name">Full name</label>
            <input
              id="profile-name"
              name="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength="2"
              maxLength="100"
              autoComplete="name"
              required
            />
            {nameError && (
              <p className="profile-form-message is-error" role="alert">
                {nameError}
              </p>
            )}
            {nameSuccess && (
              <p className="profile-form-message is-success" role="status">
                <CheckCircle2 size={15} />
                {nameSuccess}
              </p>
            )}
            <button
              className="button button-dark"
              type="submit"
              disabled={savingName || name.trim() === user?.name}
            >
              {savingName ? (
                <LoaderCircle size={15} className="icon-spin" />
              ) : (
                <Save size={15} />
              )}
              {savingName ? "Saving…" : "Save name"}
            </button>
          </form>
        </section>

        <section className="surface-card profile-action-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">SECURITY</span>
              <h2>Change password</h2>
            </div>
            <KeyRound size={19} className="muted-icon" />
          </div>
          <p className="profile-form-description">
            Enter your current password and choose a new one with at least 12
            characters.
          </p>
          <form className="profile-form" onSubmit={changePassword}>
            <PasswordField
              id="current-password"
              name="currentPassword"
              label="Current password"
              value={passwordForm.currentPassword}
              onChange={updatePasswordField}
              visible={showCurrentPassword}
              onToggle={() => setShowCurrentPassword((value) => !value)}
              autoComplete="current-password"
            />
            <PasswordField
              id="new-password"
              name="newPassword"
              label="New password"
              value={passwordForm.newPassword}
              onChange={updatePasswordField}
              visible={showNewPassword}
              onToggle={() => setShowNewPassword((value) => !value)}
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
            />
            <PasswordField
              id="confirm-password"
              name="confirmPassword"
              label="Confirm new password"
              value={passwordForm.confirmPassword}
              onChange={updatePasswordField}
              visible={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((value) => !value)}
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
            />
            {passwordError && (
              <p className="profile-form-message is-error" role="alert">
                {passwordError}
              </p>
            )}
            {passwordSuccess && (
              <p className="profile-form-message is-success" role="status">
                <CheckCircle2 size={15} />
                {passwordSuccess}
              </p>
            )}
            <button
              className="button button-dark"
              type="submit"
              disabled={
                savingPassword ||
                !passwordForm.currentPassword ||
                passwordForm.newPassword.length < 12 ||
                !passwordForm.confirmPassword
              }
            >
              {savingPassword ? (
                <LoaderCircle size={15} className="icon-spin" />
              ) : (
                <KeyRound size={15} />
              )}
              {savingPassword ? "Updating…" : "Update password"}
            </button>
          </form>
          <p className="profile-forgot-link">
            Forgot your current password?{" "}
            <Link to="/forgot-password">Reset it by email</Link>
          </p>
        </section>
      </div>
    </div>
  );
}

function ProfileItem({ icon: Icon, label, value }) {
  return (
    <div className="profile-item">
      <span className="profile-item-icon">
        <Icon size={17} />
      </span>
      <span>
        <small>{label}</small>
        <b>{value || "—"}</b>
      </span>
    </div>
  );
}

function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  minLength,
  maxLength,
}) {
  return (
    <div className="profile-password-field">
      <label htmlFor={id}>{label}</label>
      <div className="profile-password-control">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          required
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={
            visible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
        >
          <span aria-hidden="true">
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </span>
        </button>
      </div>
    </div>
  );
}
