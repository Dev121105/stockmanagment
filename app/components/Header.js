// components/Header.js
'use client';
import React from 'react';
import Link from 'next/link';

const Header = () => {
    return (
        <header className="text-gray-700 body-font shadow-lg bg-gradient-to-r from-blue-50 to-indigo-100 border-b border-blue-200">
            <div className="container mx-auto flex flex-wrap p-5 flex-col md:flex-row items-center">
                {/* Logo and Title */}
                <Link
                    href="/"
                    className="flex title-font font-bold items-center text-gray-900 mb-4 md:mb-0
                               transform transition-transform duration-300 hover:scale-105 hover:text-indigo-600" // Added hover effect
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        className="w-10 h-10 text-white p-2 bg-indigo-500 rounded-full
                                   transform transition-transform duration-300 hover:rotate-12" // Added hover rotation
                        viewBox="0 0 24 24"
                    >
                        {/* Using a box icon for stock management */}
                         <path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2zM12 20v-4m-4 4v-4m8 4v-4"></path>
                    </svg>
                    <span className="ml-3 text-xl">StockFlow</span> {/* Updated title */}
                </Link>

                {/* Navigation Links */}
                <nav className="md:ml-auto flex flex-wrap items-center text-base justify-center font-medium">
                    <Link
                        href="/"
                        className="mr-5 hover:text-indigo-600 transition duration-300 ease-in-out
                                   relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-indigo-600 after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300" // Added underline animation
                    >
                        Dashboard
                    </Link>
                    <Link
                        href="/productmaster"
                        className="mr-5 hover:text-indigo-600 transition duration-300 ease-in-out
                                   relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-indigo-600 after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300" // Added underline animation
                    >
                        Add Product
                    </Link>
                    <Link
                        href="/sales"
                        className="mr-5 hover:text-indigo-600 transition duration-300 ease-in-out
                                   relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-indigo-600 after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300" // Added underline animation
                    >
                        Sales
                    </Link>
                    <Link
                        href="/purchase"
                        className="mr-5 hover:text-indigo-600 transition duration-300 ease-in-out
                                   relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-indigo-600 after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300" // Added underline animation
                    >
                        Purchase
                    </Link>
                    {/* You can add more navigation links here with the same animation classes */}
                </nav>
            </div>
        </header>
    );
};

export default Header;
