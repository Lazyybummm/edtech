import React, { useState } from 'react';
import Button from '../ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function RegisterForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await register(name, email, password, role);
    } catch (err) {
      setError(err.message || 'Failed to register');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-5 text-left" onSubmit={handleSubmit}>
      {error && <div className="p-3 bg-red-100 border-2 border-red-500 text-red-700 font-bold rounded-xl text-sm">{error}</div>}
      <div>
        <label className="font-bold text-sm ml-2 mb-1 block">Full Name</label>
        <input 
          type="text" 
          required 
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-[#F4F4F4] border-2 border-black rounded-xl px-4 py-3 font-medium focus:outline-none focus:shadow-[4px_4px_0px_0px_#F26B4D] transition-shadow" 
          placeholder="John Doe" 
        />
      </div>
      <div>
        <label className="font-bold text-sm ml-2 mb-1 block">Email Address</label>
        <input 
          type="email" 
          required 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-[#F4F4F4] border-2 border-black rounded-xl px-4 py-3 font-medium focus:outline-none focus:shadow-[4px_4px_0px_0px_#F26B4D] transition-shadow" 
          placeholder="user@example.com" 
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
      <div>
        <label className="font-bold text-sm ml-2 mb-1 block">I am a</label>
        <select 
          value={role} 
          onChange={(e) => setRole(e.target.value)} 
          className="w-full bg-[#F4F4F4] border-2 border-black rounded-xl px-4 py-3 font-medium focus:outline-none focus:shadow-[4px_4px_0px_0px_#F26B4D] transition-shadow"
        >
          <option value="student">📚 Student - Looking to learn</option>
          <option value="educator">🎓 Educator - Want to teach</option>
        </select>
      </div>

      <Button type="submit" variant="secondary" className="w-full mt-4" disabled={isSubmitting}>
        {isSubmitting ? 'Loading...' : 'Create Account'}
      </Button>
    </form>
  );
}