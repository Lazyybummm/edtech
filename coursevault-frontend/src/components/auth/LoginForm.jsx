import React, { useState } from 'react';
import Button from '../ui/Button';
import { useAuth } from '../../context/AuthContext';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-5 text-left" onSubmit={handleSubmit}>
      {error && <div className="p-3 bg-red-100 border-2 border-red-500 text-red-700 font-bold rounded-xl text-sm">{error}</div>}
      <div>
        <label className="font-bold text-sm ml-2 mb-1 block">Email Address</label>
        <input 
          type="email" 
          required 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-[#F4F4F4] border-2 border-black rounded-xl px-4 py-3 font-medium focus:outline-none focus:shadow-[4px_4px_0px_0px_#F26B4D] transition-shadow" 
          placeholder="student@example.com" 
        />
      </div>
      <div>
        <label className="font-bold text-sm ml-2 mb-1 block">Password</label>
        <input 
          type="password" 
          required 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[#F4F4F4] border-2 border-black rounded-xl px-4 py-3 font-medium focus:outline-none focus:shadow-[4px_4px_0px_0px_#F26B4D] transition-shadow" 
          placeholder="••••••••" 
        />
      </div>

      <Button type="submit" variant="primary" className="w-full mt-4" disabled={isSubmitting}>
        {isSubmitting ? 'Loading...' : 'Enter Platform'}
      </Button>
    </form>
  );
}