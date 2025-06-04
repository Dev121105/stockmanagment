// app/components/LogoutButton.js
"use client";

import React from 'react';
import { Button } from './button'; // Assuming you have a Button component
import { auth } from '../lib/firebase'; // Import auth from your firebase.js
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.info('Logged out successfully!');
      router.push('/login'); // Redirect to login page after logout
    } catch (error) {
      console.error("Logout Error:", error);
      toast.error("Failed to log out. Please try again.");
    }
  };

  return (
    <Button
      onClick={handleLogout}
      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
    >
      Logout
    </Button>
  );
}