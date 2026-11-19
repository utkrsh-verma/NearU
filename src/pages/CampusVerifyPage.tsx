import React, { useState } from 'react';
import { AlertCircle, Building2, GraduationCap, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { BRANCH_OPTIONS, COLLEGE_OPTIONS, YEAR_OPTIONS } from '../lib/constants';

export function CampusVerifyPage() {
  const { profile, signOut, setProfile } = useAuth();
  const [college, setCollege] = useState<string>('');
  const [branch, setBranch] = useState<string>(profile?.branch || '');
  const [year, setYear] = useState<string>(profile?.batchYear || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!college) {
      setError('Please select your college.');
      return;
    }
    if (!branch) {
      setError('Please select your branch.');
      return;
    }
    if (!year) {
      setError('Please select your year.');
      return;
    }

    setSubmitting(true);
    try {
      const { profile: updated } = await api.verifyCampus({
        college,
        branch,
        year,
      });
      setProfile(updated);
    } catch (err: any) {
      setError(err?.message || 'Could not save your details. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-[#0D0E12] text-[#F3F4F6] flex flex-col">
      <header className="w-full max-w-4xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-3 border-b border-[#2A2B32]">
        <span className="font-display text-2xl font-bold tracking-tight shrink-0">
          Near<span className="text-[#E05A6D]">U</span>
        </span>
        <button
          type="button"
          onClick={signOut}
          className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1A1B20] border border-[#2A2B32] flex items-center gap-2 transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Switch account</span>
        </button>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
        <div className="bg-[#121317] border border-[#2A2B32] rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-[#1A1B20] border border-[#2A2B32] flex items-center justify-center text-[#8B5CF6] shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold text-[#F3F4F6]">
                Select your college
              </h1>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-2xl bg-[#1A1B20] border border-[#E05A6D]/50 p-4 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-[#E05A6D] shrink-0 mt-0.5" />
              <p className="text-sm text-[#F3F4F6] leading-snug">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="campus-college"
                className="block text-xs font-medium text-[#9CA3AF] mb-1.5"
              >
                College
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  id="campus-college"
                  required
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  className="w-full min-h-[48px] pl-10 pr-4 py-3 rounded-xl bg-[#1A1B20] border border-[#2A2B32] focus:border-[#E05A6D] focus:outline-none text-sm text-[#F3F4F6]"
                >
                  <option value="">Select your college</option>
                  {COLLEGE_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="campus-branch"
                  className="block text-xs font-medium text-[#9CA3AF] mb-1.5"
                >
                  Branch
                </label>
                <select
                  id="campus-branch"
                  required
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
                <label
                  htmlFor="campus-year"
                  className="block text-xs font-medium text-[#9CA3AF] mb-1.5"
                >
                  Year
                </label>
                <select
                  id="campus-year"
                  required
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#1A1B20] border border-[#2A2B32] focus:border-[#E05A6D] focus:outline-none text-sm text-[#F3F4F6]"
                >
                  <option value="">Select year</option>
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:flex-1 min-h-[48px] px-6 py-3 rounded-xl bg-[#E05A6D] hover:bg-[#cf4c5f] disabled:opacity-60 text-white font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                {submitting ? 'Saving...' : 'Continue'}
              </button>
              <button
                type="button"
                onClick={signOut}
                className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-xl bg-[#1A1B20] border border-[#2A2B32] hover:bg-[#2A2B32] text-[#F3F4F6] font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Sign out
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
