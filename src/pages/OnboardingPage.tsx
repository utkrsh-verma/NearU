import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Camera,
  Check,
  LogOut,
  Upload,
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
import { AvatarPhoto } from '../components/AvatarPhoto';
import { ProfileCardView } from '../components/ProfileCardView';

const TOTAL_STEPS = 4;

function computeClientPreviewAge(dob: string): number | null {
  const m = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) {
    age -= 1;
  }
  return age;
}

export function OnboardingPage() {
  const { profile, setProfile, signOut } = useAuth();

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth || '');
  const [gender, setGender] = useState(profile?.gender || '');
  const [branch, setBranch] = useState(profile?.branch || '');
  const [batchYear, setBatchYear] = useState(profile?.batchYear || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [lookingFor, setLookingFor] = useState(profile?.lookingFor || '');
  const [interests, setInterests] = useState<string[]>(profile?.interests || []);

  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<1 | 2 | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInput1Ref = useRef<HTMLInputElement>(null);
  const fileInput2Ref = useRef<HTMLInputElement>(null);

  const photos = profile?.photos || [];
  const photo1 = photos.find((p) => p.displayOrder === 1) || null;
  const photo2 = photos.find((p) => p.displayOrder === 2) || null;

  const previewAge = useMemo(() => computeClientPreviewAge(dateOfBirth), [dateOfBirth]);

  const toggleInterest = (item: string) => {
    setInterests((prev) => {
      if (prev.includes(item)) return prev.filter((i) => i !== item);
      if (prev.length >= 5) return prev;
      return [...prev, item];
    });
  };

  const handlePhotoUpload = async (slot: 1 | 2, file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploadingSlot(slot);
    try {
      const compressed = await compressProfilePhoto(file);
      const { profile: updated } = await api.uploadPhoto(slot, compressed);
      setProfile(updated);
    } catch (err: any) {
      setError(err?.message || 'Photo upload failed. Please try another image.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleSwapPhotos = async () => {
    if (!photo1 || !photo2) return;
    setError(null);
    setSwapping(true);
    try {
      const { profile: updated } = await api.swapPhotos();
      setProfile(updated);
    } catch (err: any) {
      setError(err?.message || 'Could not reorder photos.');
    } finally {
      setSwapping(false);
    }
  };

  const handleStepNext = async () => {
    setError(null);

    if (step === 1) {
      if (fullName.trim().length < 2) {
        setError('Please enter your full name.');
        return;
      }
      if (!dateOfBirth) {
        setError('Please enter your date of birth.');
        return;
      }
      if (!gender) {
        setError('Please select your gender.');
        return;
      }
      if (!branch || !batchYear) {
        setError('Please select your branch and batch year.');
        return;
      }

      // Persist step 1 to validate 18+ age strictly on the backend!
      setSaving(true);
      try {
        const { profile: updated } = await api.updateProfile({
          fullName: fullName.trim(),
          dateOfBirth,
          gender,
          branch,
          batchYear,
        });
        setProfile(updated);
        setStep(2);
      } catch (err: any) {
        setError(err?.message || 'Could not save basic details.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === 2) {
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!lookingFor) {
        setError('Please choose what you are looking for.');
        return;
      }
      setSaving(true);
      try {
        const { profile: updated } = await api.updateProfile({
          bio: bio.trim(),
          lookingFor,
          interests,
        });
        setProfile(updated);
        setStep(4);
      } catch (err: any) {
        setError(err?.message || 'Could not save personality details.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === 4) {
      setSaving(true);
      try {
        const { profile: updated } = await api.updateProfile({
          fullName: fullName.trim(),
          dateOfBirth,
          gender,
          branch,
          batchYear,
          bio: bio.trim(),
          lookingFor,
          interests,
          completeOnboarding: true,
        });
        setProfile(updated);
      } catch (err: any) {
        setError(err?.message || 'Could not complete onboarding.');
      } finally {
        setSaving(false);
      }
    }
  };

  const stepTitles = [
    'Basic details',
    'Profile photos',
    'Personality & intent',
    'Preview your card',
  ];

  const previewProfile = {
    id: profile?.id || 'preview',
    fullName: fullName.trim() || profile?.fullName || 'Your Name',
    age: previewAge ?? profile?.age ?? null,
    gender: gender || null,
    branch: branch || null,
    batchYear: batchYear || null,
    campusSpot: null,
    bio: bio.trim() || null,
    lookingFor: lookingFor || null,
    interests,
    isVerified: Boolean(profile?.isVerified),
    photos,
  };

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-[#0D0E12] text-[#F3F4F6] flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#0D0E12]/90 backdrop-blur-md border-b border-[#2A2B32]">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <span className="font-display text-2xl font-bold tracking-tight whitespace-nowrap shrink-0">
            Near<span className="text-[#E05A6D]">U</span>
          </span>
          <span className="text-xs sm:text-sm text-[#9CA3AF] tabular-nums min-w-0 truncate text-center">
            Step {step} of {TOTAL_STEPS} · {stepTitles[step - 1]}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1A1B20] border border-[#2A2B32] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
        {/* Progress Bar */}
        <div className="w-full h-1 bg-[#1A1B20]">
          <div
            className="h-full bg-[#E05A6D] transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </header>

      <main className="flex-1 w-full min-w-0 max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-12">
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-2xl bg-[#1A1B20] border border-[#E05A6D]/50 p-4 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-[#E05A6D] shrink-0 mt-0.5" />
            <p className="text-sm text-[#F3F4F6] leading-snug">{error}</p>
          </div>
        )}

        {/* STEP 1: BASIC DETAILS */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto bg-[#121317] border border-[#2A2B32] rounded-3xl p-6 sm:p-8 space-y-6">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F3F4F6]">
                Let&apos;s set up your campus profile
              </h1>
              <p className="text-sm text-[#9CA3AF] mt-1.5">
                Your age is verified server-side from your date of birth (18+ required).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="onb-name" className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  Full name
                </label>
                <input
                  id="onb-name"
                  type="text"
                  maxLength={60}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ananya Sharma"
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#1A1B20] border border-[#2A2B32] focus:border-[#E05A6D] focus:outline-none text-sm text-[#F3F4F6]"
                />
              </div>

              <div>
                <label htmlFor="onb-dob" className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  Date of birth {previewAge !== null && previewAge >= 18 ? `(Age ${previewAge})` : ''}
                </label>
                <input
                  id="onb-dob"
                  type="date"
                  max={new Date(new Date().setFullYear(new Date().getFullYear() - 18))
                    .toISOString()
                    .slice(0, 10)}
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#1A1B20] border border-[#2A2B32] focus:border-[#E05A6D] focus:outline-none text-sm text-[#F3F4F6] tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  Gender
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {GENDER_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setGender(opt)}
                      className={`min-h-[48px] px-2 py-2.5 rounded-xl text-xs sm:text-sm font-medium border transition-colors cursor-pointer ${
                        gender === opt
                          ? 'bg-[#E05A6D]/15 border-[#E05A6D] text-[#F3F4F6]'
                          : 'bg-[#1A1B20] border-[#2A2B32] text-[#9CA3AF] hover:text-[#F3F4F6]'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="onb-branch" className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  Branch / Program
                </label>
                <select
                  id="onb-branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#1A1B20] border border-[#2A2B32] focus:border-[#E05A6D] focus:outline-none text-sm text-[#F3F4F6]"
                >
                  <option value="">Select branch</option>
                  {BRANCH_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="onb-batch" className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                  Year
                </label>
                <select
                  id="onb-batch"
                  value={batchYear}
                  onChange={(e) => setBatchYear(e.target.value)}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#1A1B20] border border-[#2A2B32] focus:border-[#E05A6D] focus:outline-none text-sm text-[#F3F4F6]"
                >
                  <option value="">Select year</option>
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
            </div>
          </div>
        )}

        {/* STEP 2: TWO PROFILE PHOTOS */}
        {step === 2 && (
          <div className="max-w-3xl mx-auto bg-[#121317] border border-[#2A2B32] rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F3F4F6]">
                  Add your photos
                </h1>
                <p className="text-sm text-[#9CA3AF] mt-1">
                  Upload up to two clear photos. Images are compressed automatically for
                  fast mobile loading.
                </p>
              </div>
              {photo1 && photo2 && (
                <button
                  type="button"
                  onClick={handleSwapPhotos}
                  disabled={swapping}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1A1B20] border border-[#2A2B32] hover:bg-[#2A2B32] text-xs font-medium text-[#F3F4F6] flex items-center gap-2 self-start sm:self-center cursor-pointer whitespace-nowrap"
                >
                  <ArrowLeftRight className="w-4 h-4 text-[#F472B6]" />
                  <span>{swapping ? 'Swapping...' : 'Swap order'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {([1, 2] as const).map((slot) => {
                const current = slot === 1 ? photo1 : photo2;
                const ref = slot === 1 ? fileInput1Ref : fileInput2Ref;
                const isUploading = uploadingSlot === slot;
                return (
                  <div
                    key={slot}
                    className="relative rounded-2xl overflow-hidden bg-[#1A1B20] border border-[#2A2B32] aspect-[3/4] flex flex-col items-center justify-center group"
                  >
                    <input
                      ref={ref}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        handlePhotoUpload(slot, file);
                      }}
                    />

                    {current ? (
                      <>
                        <AvatarPhoto
                          src={current.url}
                          alt={`Profile photo ${slot}`}
                          name={fullName}
                          lazy={false}
                          className="w-full h-full"
                        />
                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-[#F3F4F6]">
                            {slot === 1 ? 'Primary photo' : 'Second photo'}
                          </span>
                          <button
                            type="button"
                            disabled={isUploading}
                            onClick={() => ref.current?.click()}
                            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#121317]/90 border border-[#2A2B32] hover:border-[#E05A6D] text-xs font-medium text-[#F3F4F6] flex items-center gap-1.5 cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>{isUploading ? 'Uploading...' : 'Replace'}</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => ref.current?.click()}
                        className="w-full h-full flex flex-col items-center justify-center p-6 text-center hover:bg-[#2A2B32]/40 transition-colors cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-[#121317] border border-[#2A2B32] flex items-center justify-center text-[#E05A6D] mb-3">
                          <Upload className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-semibold text-[#F3F4F6]">
                          {isUploading
                            ? 'Compressing & uploading...'
                            : slot === 1
                              ? 'Upload primary photo'
                              : 'Upload second photo'}
                        </p>
                        <p className="text-xs text-[#9CA3AF] mt-1">
                          JPG, PNG, or WebP · Portrait 3:4 works best
                        </p>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: BIO, LOOKING FOR & INTERESTS */}
        {step === 3 && (
          <div className="max-w-2xl mx-auto bg-[#121317] border border-[#2A2B32] rounded-3xl p-6 sm:p-8 space-y-6">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F3F4F6]">
                Share a bit about yourself
              </h1>
              <p className="text-sm text-[#9CA3AF] mt-1">
                Short, real details make starting campus conversations effortless.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="onb-bio" className="text-xs font-medium text-[#9CA3AF]">
                  Short bio
                </label>
                <span className="text-xs text-[#9CA3AF] tabular-nums">
                  {bio.length} / 180
                </span>
              </div>
              <textarea
                id="onb-bio"
                rows={3}
                maxLength={180}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Usually sketching near Audi Lawn or hunting for cold coffee after compiler lab..."
                className="w-full px-4 py-3 rounded-xl bg-[#1A1B20] border border-[#2A2B32] focus:border-[#E05A6D] focus:outline-none text-sm text-[#F3F4F6] resize-none leading-relaxed"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-[#9CA3AF] mb-2">
                What are you looking for?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {LOOKING_FOR_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLookingFor(option)}
                    className={`min-h-[48px] px-4 py-3 rounded-xl text-left text-sm font-medium border flex items-center justify-between transition-colors cursor-pointer ${
                      lookingFor === option
                        ? 'bg-[#E05A6D]/15 border-[#E05A6D] text-[#F3F4F6]'
                        : 'bg-[#1A1B20] border-[#2A2B32] text-[#9CA3AF] hover:text-[#F3F4F6]'
                    }`}
                  >
                    <span>{option}</span>
                    {lookingFor === option && <Check className="w-4 h-4 text-[#E05A6D]" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-[#9CA3AF]">
                  Campus interests (optional, up to 5)
                </p>
                <span className="text-xs text-[#F472B6] tabular-nums">
                  {interests.length} / 5 selected
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
                      className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors cursor-pointer disabled:opacity-40 ${
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
          </div>
        )}

        {/* STEP 4: LIVE PREVIEW */}
        {step === 4 && (
          <div className="space-y-6 w-full min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F3F4F6]">
                  Preview your Discover card
                </h1>
                <p className="text-sm text-[#9CA3AF] mt-1">
                  This is exactly how verified campus students will see you. Tap the photo
                  edges to check both photos.
                </p>
              </div>
            </div>

            <ProfileCardView profile={previewProfile} isPreview />
          </div>
        )}

        {/* Step Navigation Footer */}
        <div className="w-full max-w-5xl mx-auto mt-8 pt-6 border-t border-[#2A2B32] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          {step > 1 ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setError(null);
                setStep((s) => Math.max(1, s - 1));
              }}
              className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-xl bg-[#1A1B20] border border-[#2A2B32] hover:bg-[#2A2B32] text-sm font-medium text-[#F3F4F6] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Back</span>
            </button>
          ) : (
            <div className="hidden sm:block" />
          )}

          <button
            type="button"
            disabled={saving || uploadingSlot !== null}
            onClick={handleStepNext}
            className="w-full sm:w-auto min-h-[48px] px-5 sm:px-7 py-3 rounded-xl bg-[#E05A6D] hover:bg-[#cf4c5f] disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 text-center transition-colors cursor-pointer sm:whitespace-nowrap"
          >
            <span>
              {saving
                ? 'Saving...'
                : step === TOTAL_STEPS
                  ? 'Publish profile & Enter Discover'
                  : 'Continue'}
            </span>
            {step < TOTAL_STEPS && <ArrowRight className="w-4 h-4 shrink-0" />}
          </button>
        </div>
      </main>
    </div>
  );
}
