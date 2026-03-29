import React, { useState } from 'react';
import { type Language, t, TANZANIA_REGIONS, TANZANIA_DISTRICTS } from '../lib/i18n';

interface RegisterProps {
  onRegister: (user: any) => void;
  onBack: () => void;
  initialLanguage?: Language;
}

type Step = 'language' | 'method' | 'form';
type Method = 'email' | 'phone';

export default function Register({ onRegister, onBack, initialLanguage = 'en' }: RegisterProps) {
  const [step, setStep] = useState<Step>('language');
  const [lang, setLang] = useState<Language>(initialLanguage);
  const [method, setMethod] = useState<Method>('email');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    password: '',
    region: '',
    district: '',
    farm_size_acres: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLangSelect = (l: Language) => {
    setLang(l);
    setStep('method');
  };

  const handleMethodSelect = (m: Method) => {
    setMethod(m);
    setStep('form');
  };

  const handleChange = (field: string, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'region') next.district = '';
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.first_name.trim()) {
      setError(lang === 'sw' ? 'Jina la kwanza linahitajika' : 'First name is required');
      return;
    }
    if (method === 'email' && !form.email.trim()) {
      setError(lang === 'sw' ? 'Barua pepe inahitajika' : 'Email is required');
      return;
    }
    if (method === 'phone' && !form.phone_number.trim()) {
      setError(lang === 'sw' ? 'Nambari ya simu inahitajika' : 'Phone number is required');
      return;
    }
    if (!form.farm_size_acres || parseFloat(form.farm_size_acres) <= 0) {
      setError(lang === 'sw' ? 'Ukubwa wa shamba unahitajika' : 'Farm size is required');
      return;
    }
    if (form.password.length < 6) {
      setError(lang === 'sw' ? 'Nywila lazima iwe na herufi 6 au zaidi' : 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const body: any = {
        first_name: form.first_name,
        last_name: form.last_name || null,
        password: form.password,
        language: lang,
        region: form.region || null,
        district: form.district || null,
        farm_size_acres: form.farm_size_acres ? parseFloat(form.farm_size_acres) : null,
      };
      if (method === 'email') body.email = form.email;
      else body.phone_number = form.phone_number;

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || (lang === 'sw' ? 'Hitilafu ya usajili' : 'Registration failed'));
        return;
      }
      onRegister(data);
    } catch {
      setError(lang === 'sw' ? 'Hitilafu ya muunganisho' : 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 bg-white border-2 border-[#002c11]/10 rounded-lg text-[#002c11] text-sm font-medium transition-all duration-200 focus:border-[#035925] focus:shadow-[0_0_0_3px_rgba(3,89,37,0.1)] outline-none placeholder-[#002c11]/30";
  const labelClass = "block text-[11px] font-bold text-[#002c11]/60 mb-1.5 uppercase tracking-[0.12em]";

  const availableDistricts = form.region ? (TANZANIA_DISTRICTS[form.region] || []) : [];

  if (step === 'language') {
    return (
      <div className="w-full max-w-[380px]">
        <div className="mb-8">
          <h2 className="text-[26px] font-black text-[#002c11] mb-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
            Choose Language / Chagua Lugha
          </h2>
          <p className="text-[#5d6c7b] text-sm">Select your preferred language for the app</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleLangSelect('en')}
            className="w-full flex items-center gap-4 p-4 bg-white border-2 border-[#002c11]/10 rounded-xl hover:border-[#035925] hover:bg-[#035925]/5 transition-all group"
          >
            <span className="text-2xl">🇬🇧</span>
            <div className="text-left">
              <p className="font-bold text-[#002c11] text-sm">English</p>
              <p className="text-[#5d6c7b] text-xs">Use the app in English</p>
            </div>
          </button>
          <button
            onClick={() => handleLangSelect('sw')}
            className="w-full flex items-center gap-4 p-4 bg-white border-2 border-[#002c11]/10 rounded-xl hover:border-[#035925] hover:bg-[#035925]/5 transition-all group"
          >
            <span className="text-2xl">🇹🇿</span>
            <div className="text-left">
              <p className="font-bold text-[#002c11] text-sm">Kiswahili</p>
              <p className="text-[#5d6c7b] text-xs">Tumia programu kwa Kiswahili</p>
            </div>
          </button>
        </div>

        <button onClick={onBack} className="mt-6 text-sm text-[#5d6c7b] hover:text-[#002c11] flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          Back to Sign In
        </button>
      </div>
    );
  }

  if (step === 'method') {
    return (
      <div className="w-full max-w-[380px]">
        <div className="mb-8">
          <h2 className="text-[26px] font-black text-[#002c11] mb-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
            {t(lang, 'registerTitle')}
          </h2>
          <p className="text-[#5d6c7b] text-sm">{t(lang, 'phoneOrEmail')}</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleMethodSelect('email')}
            className="w-full flex items-center gap-4 p-4 bg-white border-2 border-[#002c11]/10 rounded-xl hover:border-[#035925] hover:bg-[#035925]/5 transition-all"
          >
            <div className="w-10 h-10 bg-[#035925]/10 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[#035925]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <div className="text-left">
              <p className="font-bold text-[#002c11] text-sm">{t(lang, 'email')}</p>
              <p className="text-[#5d6c7b] text-xs">{lang === 'sw' ? 'Jiandikishe kwa barua pepe' : 'Register with email address'}</p>
            </div>
          </button>

          <button
            onClick={() => handleMethodSelect('phone')}
            className="w-full flex items-center gap-4 p-4 bg-white border-2 border-[#002c11]/10 rounded-xl hover:border-[#035925] hover:bg-[#035925]/5 transition-all"
          >
            <div className="w-10 h-10 bg-[#035925]/10 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[#035925]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </div>
            <div className="text-left">
              <p className="font-bold text-[#002c11] text-sm">{t(lang, 'phoneNumber')}</p>
              <p className="text-[#5d6c7b] text-xs">{lang === 'sw' ? 'Jiandikishe kwa nambari ya simu' : 'Register with mobile number'}</p>
            </div>
          </button>
        </div>

        <button onClick={() => setStep('language')} className="mt-6 text-sm text-[#5d6c7b] hover:text-[#002c11] flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          {t(lang, 'back')}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-6">
        <h2 className="text-[24px] font-black text-[#002c11] mb-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
          {t(lang, 'registerTitle')}
        </h2>
        <p className="text-[#5d6c7b] text-sm">{t(lang, 'registerSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t(lang, 'firstName')} *</label>
            <input
              type="text"
              value={form.first_name}
              onChange={e => handleChange('first_name', e.target.value)}
              placeholder={lang === 'sw' ? 'Jina lako' : 'Your first name'}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{t(lang, 'lastName')}</label>
            <input
              type="text"
              value={form.last_name}
              onChange={e => handleChange('last_name', e.target.value)}
              placeholder={lang === 'sw' ? 'Jina la ukoo' : 'Last name'}
              className={inputClass}
            />
          </div>
        </div>

        {method === 'email' ? (
          <div>
            <label className={labelClass}>{t(lang, 'email')} *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => handleChange('email', e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
              required
            />
          </div>
        ) : (
          <div>
            <label className={labelClass}>{t(lang, 'phoneNumber')} *</label>
            <input
              type="tel"
              value={form.phone_number}
              onChange={e => handleChange('phone_number', e.target.value)}
              placeholder="+255 7XX XXX XXX"
              className={inputClass}
              required
            />
          </div>
        )}

        <div>
          <label className={labelClass}>
            {t(lang, 'password')} *
            <span className="text-[#5d6c7b]/60 normal-case font-normal ml-1">({t(lang, 'passwordMin')})</span>
          </label>
          <input
            type="password"
            value={form.password}
            onChange={e => handleChange('password', e.target.value)}
            placeholder={lang === 'sw' ? 'Neno au Namba ya Siri' : 'Choose a password'}
            className={inputClass}
            required
          />
        </div>

        <div className="pt-2 border-t border-[#002c11]/5">
          <p className="text-[11px] font-bold text-[#002c11]/60 uppercase tracking-[0.12em] mb-3">
            {t(lang, 'farmInfo')}
          </p>

          <div className="space-y-3">
            <div>
              <label className={labelClass}>{t(lang, 'region')}</label>
              <select
                value={form.region}
                onChange={e => handleChange('region', e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="">{t(lang, 'selectRegion')}</option>
                {TANZANIA_REGIONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t(lang, 'district')}</label>
                {availableDistricts.length > 0 ? (
                  <select
                    value={form.district}
                    onChange={e => handleChange('district', e.target.value)}
                    className={`${inputClass} bg-white`}
                  >
                    <option value="">{t(lang, 'selectDistrict')}</option>
                    {availableDistricts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.district}
                    onChange={e => handleChange('district', e.target.value)}
                    placeholder={t(lang, 'enterDistrict')}
                    className={inputClass}
                  />
                )}
              </div>
              <div>
                <label className={labelClass}>{t(lang, 'farmSize')} *</label>
                <input
                  type="number"
                  value={form.farm_size_acres}
                  onChange={e => handleChange('farm_size_acres', e.target.value)}
                  placeholder="e.g. 5"
                  min="0.1"
                  step="0.1"
                  className={inputClass}
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-red-700 text-sm bg-red-50 p-3 rounded-lg border border-red-200 font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#035925] hover:bg-[#002c11] text-white py-3.5 rounded-lg font-bold text-sm transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
          style={{ fontFamily: "'Instrument Sans', sans-serif" }}
        >
          {loading ? (lang === 'sw' ? 'Inasajili...' : 'Creating account...') : t(lang, 'createAccount')}
        </button>
      </form>

      <button onClick={() => setStep('method')} className="mt-4 text-sm text-[#5d6c7b] hover:text-[#002c11] flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
        {t(lang, 'back')}
      </button>
    </div>
  );
}
