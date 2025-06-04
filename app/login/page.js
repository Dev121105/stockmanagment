// app/login/page.js
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '../components/button'; // Assuming you have a Button component
import { auth } from '../lib/firebase'; // Import auth from your firebase.js
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    updateProfile // To update user's display name
} from 'firebase/auth';
import { toast } from 'sonner'; // For notifications
import { useRouter } from 'next/navigation'; // Import useRouter for redirection

const LoginPage = () => { // Renamed to LoginPage to avoid conflict with Login component
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(''); // For registration
    const [isRegistering, setIsRegistering] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    // Listen for auth state changes to automatically redirect authenticated users
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                // User is signed in, redirect to dashboard
                console.log("Login page: User is already logged in, redirecting to dashboard:", user.uid);
                router.push('/');
            }
        });
        return () => unsubscribe(); // Cleanup subscription
    }, [router]);

    const handleAuthAction = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isRegistering) {
                // Register new user
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Update user profile with display name if provided
                if (name) {
                    await updateProfile(user, { displayName: name });
                }
                toast.success(`Welcome, ${name || user.email}! Your account has been created.`);
                router.push('/'); // Redirect to dashboard after successful registration
            } else {
                // Sign in existing user
                await signInWithEmailAndPassword(auth, email, password);
                toast.success(`Welcome back, ${auth.currentUser?.displayName || auth.currentUser?.email}! You are logged in.`);
                router.push('/'); // Redirect to dashboard after successful login
            }
        } catch (err) {
            console.error("Authentication error:", err);
            let errorMessage = "An unexpected error occurred. Please try again.";
            if (err.code) {
                switch (err.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = 'This email is already in use. Try logging in or use a different email.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Please enter a valid email address.';
                        break;
                    case 'auth/operation-not-allowed':
                        errorMessage = 'Email/password authentication is not enabled. Please contact support.';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'Password is too weak. Please use at least 6 characters.';
                        break;
                    case 'auth/user-disabled':
                        errorMessage = 'Your account has been disabled.';
                        break;
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        errorMessage = 'Invalid email or password.';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = 'Network error. Please check your internet connection.';
                        break;
                    default:
                        errorMessage = `Authentication failed: ${err.message}`;
                }
            }
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md border border-gray-200 animate-scale-in">
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
                    {isRegistering ? 'Register' : 'Login'} to StockFlow
                </h2>
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                        <strong className="font-bold">Error:</strong>
                        <span className="block sm:inline ml-2">{error}</span>
                    </div>
                )}
                <form onSubmit={handleAuthAction}>
                    {isRegistering && (
                        <div className="mb-4">
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name (Optional)</label>
                            <input
                                type="text"
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                placeholder="Your Name"
                            />
                        </div>
                    )}
                    <div className="mb-4">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="you@example.com"
                        />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="••••••••"
                        />
                    </div>
                    <Button
                        type="submit"
                        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                {isRegistering ? 'Registering...' : 'Logging In...'}
                            </span>
                        ) : (
                            isRegistering ? 'Register' : 'Login'
                        )}
                    </Button>
                </form>
                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-600">
                        {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
                        <button
                            onClick={() => setIsRegistering(!isRegistering)}
                            className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors duration-200"
                        >
                            {isRegistering ? 'Login here' : 'Register here'}
                        </button>
                    </p>
                </div>
            </div>
            <style jsx>{`
                .animate-scale-in {
                    animation: scaleIn 0.3s ease-out forwards;
                }
                @keyframes scaleIn {
                    0% { transform: scale(0.95); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default LoginPage;
