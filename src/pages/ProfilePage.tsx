import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  BadgeCheck,
  Camera,
  Check,
  Eye,
  LogOut,
  Save,
  Shield,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import {
  BRANCH_OPTIONS,
  GENDER_OPTIONS,
  INTEREST_OPTIONS,
  LOOKING_FOR_OPTIONS,
  YEAR_OPTIONS,
} from '../lib/constants';
import { compressProfilePhoto } from '../lib/imageCompression';
import { removeUploadedProfilePhoto, uploadProfilePhoto } from '../lib/profilePhotoUpload';
import { AvatarPhoto } from '../components/AvatarPhoto';
import { ProfileCardView } from '../components/ProfileCardView';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function ProfilePage() {
  const { profile, setProfile, signOut, deleteAccount } = useAuth();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [gender, setGender] = useState(profile?.gender || '');
  const [branch, setBranch] = useState(profile?.branch || '');
  const [batchYear, setBatchYear] = useState(profile?.batchYear || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [lookingFor, setLookingFor] = useState(profile?.lookingFor || '');
  const [interests, setInterests] = useState<string[]>(profile?.interests || []);

  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<1 | 2 | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fileInput1Ref = useRef<HTMLInputElement>(null);
  const fileInput2Ref = useRef<HTMLInputElement>(null);

  if (!profile) return null;

  const photo1 = profile.photos.find((p) => p.displayOrder === 1) || null;
  const photo2 = profile.photos.find((p) => p.displayOrder === 2) || null;

  const toggleInterest = (item: string) => {
    setInterests((prev) => {
      if (prev.includes(item)) return prev.filter((i) => i !== item);
      if (prev.length >= 5) return prev;
      return [...prev, item];
    });
  };

  const handlePhotoReplace = async (slot: 1 | 2, file: File | undefined) => {
    if (!file) return;
    setError(null);
    setSavedNotice(null);
    setUploadingSlot(slot);
    try {
      const storagePath = await uploadProfilePhoto(await compressProfilePhoto(file), profile.id);
      let updated;
      try { ({ profile: updated } = await api.uploadPhoto(slot, storagePath)); }
      catch (error) { await removeUploadedProfilePhoto(storagePath); throw error; }
      setProfile(updated);
      setSavedNotice(`Photo ${slot} updated.`);
    } catch (err: any) {
      setError(err?.message || 'Photo upload failed.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleSwapPhotos = async () => {
    if (!photo1 || !photo2) return;
    setError(null);
    setSavedNotice(null);
    setSwapping(true);
    try {
      const { profile: updated } = await api.swapPhotos();
      setProfile(updated);
      setSavedNotice('Photo order swapped.');
    } catch (err: any) {
      setError(err?.message || 'Could not reorder photos.');
    } finally {
      setSwapping(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedNotice(null);
    setSaving(true);
    try {
      const { profile: updated } = await api.updateProfile({
        fullName: fullName.trim(),
        gender,
        branch,
        batchYear,
        bio: bio.trim(),
        lookingFor,
        interests,
      });
      setProfile(updated);
      setSavedNotice('Profile saved.');
    } catch (err: any) {
      setError(err?.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setError(null);
    setSavedNotice(null);
    setDeleting(true);
    try {
      await deleteAccount();
    } catch (err: any) {
      setError(err?.message || 'Could not delete your account. Please try again.');
      setConfirmDeleteOpen(false);
      setDeleting(false);
    }
  };

  const previewData = {
    ...profile,
    fullName: fullName.trim() || profile.fullName,
    gender,
    branch,
    batchYear,
    campusSpot: null,
    bio: bio.trim(),
    lookingFor,
    interests,
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F3F4F6] tracking-tight">
            Your Profile
          </h1>
          <p className="text-xs sm:text-sm text-[#9CA3AF] mt-0.5 flex items-center gap-1.5">
            <BadgeCheck className="w-4 h-4 text-[#8B5CF6]" />
            <span>
              Verified GL Bajaj student · {profile.collegeEmail || profile.email}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#121317] border border-[#2A2B32] hover:bg-[#1A1B20] text-xs font-medium text-[#F3F4F6] flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Eye className="w-4 h-4 text-[#F472B6]" />
            <span>{showPreview ? 'Back to editor' : 'Preview card'}</span>
          </button>

          <button
            type="button"
            onClick={signOut}
            className="lg:hidden min-h-[42px] px-3.5 py-2 rounded-xl bg-[#121317] border border-[#2A2B32] hover:bg-[#1A1B20] text-xs font-medium text-[#9CA3AF] hover:text-[#F3F4F6] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-2xl bg-[#1A1B20] border border-[#E05A6D]/50 p-4 flex items-center gap-3 text-sm text-[#F3F4F6]"
        >
          <AlertCircle className="w-5 h-5 text-[#E05A6D] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {savedNotice && (
        <div
          role="status"
          className="mb-5 rounded-2xl bg-[#1A1B20] border border-[#8B5CF6]/50 p-4 flex items-center gap-3 text-sm text-[#F3F4F6]"
        >
          <Check className="w-5 h-5 text-[#8B5CF6] shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {showPreview ? (
        <ProfileCardView profile={previewData} isPreview />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Left Column: Two Photos & Privacy Summary */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#121317] border border-[#2A2B32] rounded-3xl p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="font-display text-lg font-semibold text-[#F3F4F6]">
                  Profile photos
                </h2>
                {photo1 && photo2 && (
                  <button
                    type="button"
                    onClick={handleSwapPhotos}
                    disabled={swapping}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1A1B20] border border-[#2A2B32] hover:bg-[#2A2B32] text-xs font-medium text-[#F3F4F6] flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 text-[#F472B6]" />
                    <span>{swapping ? 'Swapping...' : 'Swap order'}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                {([1, 2] as const).map((slot) => {
                  const current = slot === 1 ? photo1 : photo2;
                  const ref = slot === 1 ? fileInput1Ref : fileInput2Ref;
                  const isUploading = uploadingSlot === slot;
                  return (
                    <div
                      key={slot}
                      className="relative rounded-2xl overflow-hidden bg-[#1A1B20] border border-[#2A2B32] aspect-[3/4]"
                    >
                      <input
                        ref={ref}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          handlePhotoReplace(slot, file);
                        }}
                      />
                      <AvatarPhoto
                        src={current?.url}
                        alt={`Your photo ${slot}`}
                        name={profile.fullName}
                        className="w-full h-full"
                      />
                      <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/85 to-transparent flex items-center justify-between">
                        <span className="text-[11px] font-medium text-[#F3F4F6]">
                          Photo {slot}
                        </span>
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={() => ref.current?.click()}
                          className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#121317]/90 border border-[#2A2B32] hover:border-[#E05A6D] text-[11px] font-medium text-[#F3F4F6] flex items-center gap-1 cursor-pointer"
                        >
                          <Camera className="w-3 h-3" />
                          <span>{isUploading ? '...' : 'Replace'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#121317] border border-[#2A2B32] rounded-3xl p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-[#F3F4F6]">
                <Shield className="w-4 h-4 text-[#8B5CF6]" />
                <span>Campus Privacy &amp; Identity</span>
              </div>
              <dl className="text-xs space-y-2.5 pt-2 border-t border-[#2A2B32]">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#9CA3AF]">Age (verified)</dt>
                  <dd className="text-[#F3F4F6] font-medium tabular-nums">
                    {profile.age ?? '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#9CA3AF]">Account email</dt>
                  <dd className="text-[#F3F4F6] truncate max-w-[200px]">
                    {profile.email}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#9CA3AF]">Blocked accounts</dt>
                  <dd className="text-[#F3F4F6] font-medium tabular-nums">
                    {profile.blockedCount}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Right Column: Editable Profile Form */}
          <form
            onSubmit={handleSave}
            className="lg:col-span-7 bg-[#121317] border border-[#2A2B32] rounded-3xl p-5 sm:p-8 space-y-5"
          >
            <h2 className="font-display text-lg font-semibold text-[#F3F4F6]">
              Edit details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="prof-name" className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  Full name
                </label>
                <input
                  id="prof-name"
                  type="text"
                  maxLength={60}
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#1A1B20] border border-[#2A2B32] focus:border-[#E05A6D] focus:outline-none text-sm text-[#F3F4F6]"
                />
              </div>

              <div>
                <label htmlFor="prof-branch" className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  Branch / Program
                </label>
                <select
                  id="prof-branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#1A1B20] border border-[#2A2B32] focus:border-[#E05A6D] focus:outline-none text-sm text-[#F3F4F6]"
                >
                  {BRANCH_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                  {branch && !(BRANCH_OPTIONS as readonly string[]).includes(branch) && (
                    <option value={branch}>{branch}</option>
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="prof-batch" className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  Year
                </label>
                <select
                  id="prof-batch"
                  value={batchYear}
                  onChange={(e) => setBatchYear(e.target.value)}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#1A1B20] border border-[#2A2B32] focus:border-[#E05A6D] focus:outline-none text-sm text-[#F3F4F6]"
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                  {batchYear && !(YEAR_OPTIONS as readonly string[]).includes(batchYear) && (
                    <option value={batchYear}>{batchYear}</option>
                  )}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="prof-gender" className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  Gender
                </label>
                <select
                  id="prof-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#1A1B20] border border-[#2A2B32] focus:border-[#E05A6D] focus:outline-none text-sm text-[#F3F4F6]"
                >
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="prof-bio" className="text-xs font-medium text-[#9CA3AF]">
                  Bio
                </label>
                <span className="text-xs text-[#9CA3AF] tabular-nums">
                  {bio.length} / 180
                </span>
              </div>
              <textarea
                id="prof-bio"
                rows={3}
                maxLength={180}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#1A1B20] border border-[#2A2B32] focus:border-[#E05A6D] focus:outline-none text-sm text-[#F3F4F6] resize-none leading-relaxed"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-[#9CA3AF] mb-2">Looking for</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {LOOKING_FOR_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setLookingFor(opt)}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-left text-sm font-medium border flex items-center justify-between transition-colors cursor-pointer ${
                      lookingFor === opt
                        ? 'bg-[#E05A6D]/15 border-[#E05A6D] text-[#F3F4F6]'
                        : 'bg-[#1A1B20] border-[#2A2B32] text-[#9CA3AF] hover:text-[#F3F4F6]'
                    }`}
                  >
                    <span>{opt}</span>
                    {lookingFor === opt && <Check className="w-4 h-4 text-[#E05A6D]" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-[#9CA3AF]">Interests (up to 5)</p>
                <span className="text-xs text-[#F472B6] tabular-nums">
                  {interests.length} / 5
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((item) => {
                  const selected = interests.includes(item);
                  const disabled = !selected && interests.length >= 5;
                  return (
                    <button
                      key={item}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleInterest(item)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer disabled:opacity-40 ${
                        selected
                          ? 'bg-[#E05A6D] border-[#E05A6D] text-white'
                          : 'bg-[#1A1B20] border-[#2A2B32] text-[#D1D5DB] hover:border-[#9CA3AF]'
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl bg-[#E05A6D] hover:bg-[#cf4c5f] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving changes...' : 'Save changes'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Account Deletion */}
      <div className="mt-6 lg:mt-8 bg-[#121317] border border-[#E05A6D]/30 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-base sm:text-lg font-semibold text-[#F3F4F6]">
            Delete account
          </h2>
          <p className="text-xs sm:text-sm text-[#9CA3AF] mt-1 leading-relaxed">
            Permanently remove your profile, photos, likes, matches, and chat history.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={deleting}
          className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1A1B20] border border-[#E05A6D]/50 hover:bg-[#E05A6D]/15 text-sm font-medium text-[#E05A6D] flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Trash2 className="w-4 h-4 shrink-0" />
          <span>Delete account</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        mode="delete_account"
        targetName={profile.fullName || 'your account'}
        loading={deleting}
        onCancel={() => !deleting && setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}
