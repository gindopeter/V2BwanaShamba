import { useState, useEffect } from 'react';
import { Lock, User, Shield, Trash2, Plus, Check, AlertCircle, Eye, EyeOff, UserPlus, Edit2, X, UserX, UserCheck, Globe } from 'lucide-react';
import type { AuthUser } from '../App';
import { type Language, t, TANZANIA_REGIONS } from '../lib/i18n';

interface SettingsPageProps {
  user: AuthUser;
  onUserUpdate: (user: AuthUser) => void;
  lang?: Language;
}

export default function SettingsPage({ user, onUserUpdate, lang = 'en' }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'users'>('profile');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex gap-2 bg-white border border-[#002c11]/10 rounded-xl p-1.5 shadow-sm flex-wrap">
        <TabButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<User size={16} />} label={t(lang, 'profile')} />
        <TabButton active={activeTab === 'password'} onClick={() => setActiveTab('password')} icon={<Lock size={16} />} label={t(lang, 'changePassword')} />
        {user.role === 'admin' && (
          <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Shield size={16} />} label={t(lang, 'manageUsers')} />
        )}
      </div>

      {activeTab === 'profile' && <ProfileSection user={user} onUserUpdate={onUserUpdate} lang={lang} />}
      {activeTab === 'password' && <PasswordSection lang={lang} />}
      {activeTab === 'users' && user.role === 'admin' && <UsersSection currentUserId={user.id} />}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-[#035925] text-white shadow-sm'
          : 'text-[#5d6c7b] hover:bg-[#002c11]/5 hover:text-[#002c11]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ProfileSection({ user, onUserUpdate, lang = 'en' }: { user: AuthUser; onUserUpdate: (u: AuthUser) => void; lang?: Language }) {
  const [firstName, setFirstName] = useState(user.first_name || '');
  const [lastName, setLastName] = useState(user.last_name || '');
  const [language, setLanguage] = useState<Language>((user.language as Language) || 'en');
  const [region, setRegion] = useState(user.region || '');
  const [district, setDistrict] = useState(user.district || '');
  const [farmSize, setFarmSize] = useState(user.farm_size_acres ? String(user.farm_size_acres) : '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          language,
          region: region || null,
          district: district || null,
          farm_size_acres: farmSize ? parseFloat(farmSize) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || (lang === 'sw' ? 'Imeshindwa kusasisha wasifu' : 'Failed to update profile') });
        return;
      }
      onUserUpdate(data);
      setMessage({ type: 'success', text: lang === 'sw' ? 'Wasifu umesasishwa' : 'Profile updated successfully' });
    } catch {
      setMessage({ type: 'error', text: lang === 'sw' ? 'Hitilafu ya muunganisho' : 'Connection error' });
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-4 py-3 border border-[#002c11]/10 rounded-xl text-[#002c11] focus:ring-2 focus:ring-[#035925]/30 focus:border-[#035925] transition-all bg-white";

  return (
    <div className="bg-white border border-[#002c11]/10 rounded-2xl shadow-sm p-6">
      <h3 className="text-lg font-bold text-[#002c11] mb-1">{t(lang, 'profile')}</h3>
      <p className="text-sm text-[#5d6c7b] mb-6">{lang === 'sw' ? 'Sasisha jina lako na maelezo ya kibinafsi.' : 'Update your name and personal details.'}</p>

      <form onSubmit={handleSave} className="space-y-5">
        {user.email && (
          <div>
            <label className="block text-sm font-semibold text-[#002c11]/80 mb-1.5">{t(lang, 'email')}</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-4 py-3 bg-[#f9f6f1] border border-[#002c11]/10 rounded-xl text-[#5d6c7b] cursor-not-allowed"
            />
          </div>
        )}
        {user.phone_number && (
          <div>
            <label className="block text-sm font-semibold text-[#002c11]/80 mb-1.5">{t(lang, 'phoneNumber')}</label>
            <input
              type="tel"
              value={user.phone_number}
              disabled
              className="w-full px-4 py-3 bg-[#f9f6f1] border border-[#002c11]/10 rounded-xl text-[#5d6c7b] cursor-not-allowed"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#002c11]/80 mb-1.5">{t(lang, 'firstName')}</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
              placeholder={lang === 'sw' ? 'Jina la kwanza' : 'First name'}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#002c11]/80 mb-1.5">{t(lang, 'lastName')}</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
              placeholder={lang === 'sw' ? 'Jina la mwisho' : 'Last name'}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#002c11]/80 mb-1.5">{t(lang, 'languagePref')}</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${language === 'en' ? 'bg-[#035925] text-white border-[#035925]' : 'border-[#002c11]/10 text-[#5d6c7b] hover:border-[#035925]/30'}`}
            >
              🇬🇧 English
            </button>
            <button
              type="button"
              onClick={() => setLanguage('sw')}
              className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${language === 'sw' ? 'bg-[#035925] text-white border-[#035925]' : 'border-[#002c11]/10 text-[#5d6c7b] hover:border-[#035925]/30'}`}
            >
              🇹🇿 Kiswahili
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-[#002c11]/5">
          <p className="text-xs font-bold text-[#002c11]/40 uppercase tracking-wider mb-3">{t(lang, 'farmInfo')}</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#002c11]/80 mb-1.5">{t(lang, 'region')}</label>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className={inputClass}
              >
                <option value="">{t(lang, 'selectRegion')}</option>
                {TANZANIA_REGIONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#002c11]/80 mb-1.5">{t(lang, 'district')}</label>
                <input
                  type="text"
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                  className={inputClass}
                  placeholder={t(lang, 'enterDistrict')}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#002c11]/80 mb-1.5">{t(lang, 'farmSize')}</label>
                <input
                  type="number"
                  value={farmSize}
                  onChange={e => setFarmSize(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 5"
                  min="0"
                  step="0.1"
                />
              </div>
            </div>
          </div>
        </div>

        <StatusMessage message={message} />

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-[#035925] hover:bg-[#002c11] text-white px-6 py-3 rounded-xl font-medium shadow-sm transition-all active:scale-95 disabled:opacity-70"
        >
          {saving ? (lang === 'sw' ? 'Inahifadhi...' : 'Saving...') : <><Check size={18} /> {t(lang, 'saveChanges')}</>}
        </button>
      </form>
    </div>
  );
}

function PasswordSection({ lang = 'en' }: { lang?: Language }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!currentPassword || !newPassword) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to change password' });
        return;
      }
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-[#002c11]/10 rounded-2xl shadow-sm p-6">
      <h3 className="text-lg font-bold text-[#002c11] mb-1">Change Password</h3>
      <p className="text-sm text-[#5d6c7b] mb-6">Enter your current password and choose a new one.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-[#002c11]/80 mb-1.5">Current Password</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-3 pr-12 border border-[#002c11]/10 rounded-xl text-[#002c11] focus:ring-2 focus:ring-[#035925]/30 focus:border-[#035925] transition-all"
              placeholder="Enter current password"
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5d6c7b]/60 hover:text-[#5d6c7b]">
              {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#002c11]/80 mb-1.5">New Password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 pr-12 border border-[#002c11]/10 rounded-xl text-[#002c11] focus:ring-2 focus:ring-[#035925]/30 focus:border-[#035925] transition-all"
              placeholder="At least 6 characters"
            />
            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5d6c7b]/60 hover:text-[#5d6c7b]">
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#002c11]/80 mb-1.5">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 border border-[#002c11]/10 rounded-xl text-[#002c11] focus:ring-2 focus:ring-[#035925]/30 focus:border-[#035925] transition-all"
            placeholder="Re-enter new password"
          />
        </div>

        <StatusMessage message={message} />

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-[#035925] hover:bg-[#002c11] text-white px-6 py-3 rounded-xl font-medium shadow-sm transition-all active:scale-95 disabled:opacity-70"
        >
          {saving ? 'Changing...' : <><Lock size={18} /> Change Password</>}
        </button>
      </form>
    </div>
  );
}

function UsersSection({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/auth/users', { credentials: 'include' });
      if (res.ok) setUsers(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const resetForm = () => {
    setNewEmail(''); setNewPassword(''); setNewFirstName(''); setNewLastName(''); setNewRole('user');
    setEditingUser(null); setShowForm(false);
  };

  const startEdit = (u: any) => {
    setEditingUser(u);
    setNewEmail(u.email);
    setNewFirstName(u.first_name || '');
    setNewLastName(u.last_name || '');
    setNewRole(u.role);
    setNewPassword('');
    setShowForm(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!newEmail || (!editingUser && !newPassword)) {
      setMessage({ type: 'error', text: 'Email and password are required' });
      return;
    }
    setCreating(true);
    try {
      if (editingUser) {
        const body: any = { email: newEmail, first_name: newFirstName, last_name: newLastName, role: newRole };
        if (newPassword) body.password = newPassword;
        const res = await fetch(`/api/auth/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { setMessage({ type: 'error', text: data.message || 'Failed to update user' }); return; }
        setMessage({ type: 'success', text: 'User updated successfully' });
      } else {
        const res = await fetch('/api/auth/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: newEmail, password: newPassword, first_name: newFirstName, last_name: newLastName, role: newRole }),
        });
        const data = await res.json();
        if (!res.ok) { setMessage({ type: 'error', text: data.message || 'Failed to create user' }); return; }
        setMessage({ type: 'success', text: 'User created successfully' });
      }
      resetForm();
      loadUsers();
    } catch {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (id: number, currentlyActive: boolean) => {
    const action = currentlyActive ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
      const res = await fetch(`/api/auth/users/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !currentlyActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || `Failed to ${action} user` });
        return;
      }
      setMessage({ type: 'success', text: `User ${action}d successfully` });
      loadUsers();
    } catch {
      setMessage({ type: 'error', text: 'Connection error' });
    }
  };

  const handleDelete = async (id: number, email: string) => {
    if (!confirm(`Permanently remove ${email}? Their farm data will be preserved, but they will no longer be able to log in.`)) return;
    try {
      const res = await fetch(`/api/auth/users/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to remove user' });
        return;
      }
      setMessage({ type: 'success', text: 'User removed successfully' });
      loadUsers();
    } catch {
      setMessage({ type: 'error', text: 'Connection error' });
    }
  };

  return (
    <div className="bg-white border border-[#002c11]/10 rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-[#002c11] mb-1">Manage Users</h3>
          <p className="text-sm text-[#5d6c7b]">Create and manage user accounts.</p>
        </div>
        <button
          onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
          className="flex items-center gap-2 bg-[#035925] hover:bg-[#002c11] text-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all active:scale-95 text-sm"
        >
          {showForm ? <><X size={16} /> Cancel</> : <><UserPlus size={16} /> Add User</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-[#f9f6f1] border border-[#002c11]/10 rounded-xl p-5 mb-6 space-y-4">
          <p className="text-sm font-bold text-[#002c11]">{editingUser ? 'Edit User' : 'New User'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#002c11]/80 mb-1">Email *</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full px-3 py-2.5 border border-[#002c11]/10 rounded-lg text-[#002c11] text-sm focus:ring-2 focus:ring-[#035925]/30 focus:border-[#035925]" placeholder="user@farm.co.tz" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#002c11]/80 mb-1">{editingUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2.5 border border-[#002c11]/10 rounded-lg text-[#002c11] text-sm focus:ring-2 focus:ring-[#035925]/30 focus:border-[#035925]" placeholder="Min 6 characters" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#002c11]/80 mb-1">First Name</label>
              <input type="text" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} className="w-full px-3 py-2.5 border border-[#002c11]/10 rounded-lg text-[#002c11] text-sm focus:ring-2 focus:ring-[#035925]/30 focus:border-[#035925]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#002c11]/80 mb-1">Last Name</label>
              <input type="text" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} className="w-full px-3 py-2.5 border border-[#002c11]/10 rounded-lg text-[#002c11] text-sm focus:ring-2 focus:ring-[#035925]/30 focus:border-[#035925]" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#002c11]/80 mb-1">Role</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full px-3 py-2.5 border border-[#002c11]/10 rounded-lg text-[#002c11] text-sm focus:ring-2 focus:ring-[#035925]/30 focus:border-[#035925] bg-white">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" disabled={creating} className="flex items-center gap-2 bg-[#035925] hover:bg-[#002c11] text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-all active:scale-95 disabled:opacity-70">
            {creating ? 'Saving...' : editingUser ? <><Check size={16} /> Save Changes</> : <><Plus size={16} /> Create User</>}
          </button>
        </form>
      )}

      <StatusMessage message={message} />

      {loading ? (
        <p className="text-sm text-[#5d6c7b] py-4 text-center">Loading users...</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {users.filter(u => !u.email?.includes('_deleted_')).map((u) => {
            const isActive = u.is_active !== 0;
            return (
              <div key={u.id} className={`flex items-center justify-between py-4 first:pt-0 last:pb-0 ${!isActive ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isActive ? 'bg-[#035925]/10 text-[#035925]' : 'bg-gray-200 text-gray-500'}`}>
                    {(u.first_name || u.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#002c11]">
                      {u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.email}
                    </p>
                    <p className="text-xs text-[#5d6c7b]">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${u.role === 'admin' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-[#002c11]/5 text-[#5d6c7b] border border-[#002c11]/10'}`}>
                    {u.role}
                  </span>
                  {!isActive && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                      Inactive
                    </span>
                  )}
                  {u.id !== currentUserId && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(u)} className="p-2 text-[#5d6c7b]/60 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit user">
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(u.id, isActive)}
                        className={`p-2 rounded-lg transition-all ${isActive ? 'text-[#5d6c7b]/60 hover:text-amber-600 hover:bg-amber-50' : 'text-[#5d6c7b]/60 hover:text-green-600 hover:bg-green-50'}`}
                        title={isActive ? 'Deactivate user' : 'Reactivate user'}
                      >
                        {isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                      </button>
                      <button onClick={() => handleDelete(u.id, u.email)} className="p-2 text-[#5d6c7b]/60 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Remove user">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusMessage({ message }: { message: { type: 'success' | 'error'; text: string } | null }) {
  if (!message) return null;
  return (
    <div className={`flex items-center gap-2 text-sm p-3 rounded-xl mb-4 ${
      message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
    }`}>
      {message.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
      {message.text}
    </div>
  );
}
