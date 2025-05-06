// components/Header.js
'use client';
import React from 'react';
import Link from 'next/link';

const Header = () => {
    return (
        <header className="text-gray-600 body-font shadow-md bg-white">
            <div className="container mx-auto flex flex-wrap p-5 flex-col md:flex-row items-center">
                <Link href="/" className="flex title-font font-medium items-center text-gray-900 mb-4 md:mb-0">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        className="w-10 h-10 text-indigo-500 p-2 bg-indigo-100 rounded-full"
                        viewBox="0 0 24 24"
                    >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path>
                        {/* You can replace the above path with a more relevant icon for stock management */}
                        {/* Example of a box icon: */}
                        {/* <path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2zM12 20v-4m-4 4v-4m8 4v-4"></path> */}
                    </svg>
                    <span className="ml-3 text-xl">Stock Management</span>
                </Link>

                <nav className="md:ml-auto flex flex-wrap items-center text-base justify-center">
                    <Link href="/" className="mr-5 hover:text-gray-900">Dashboard</Link>
                    <Link href="/productmaster" className="mr-5 hover:text-gray-900">Add Product</Link>
                    <Link href="/sales" className="mr-5 hover:text-gray-900">Sales</Link>
                    <Link href="/purchase" className="mr-5 hover:text-gray-900">Purchase</Link>
                    {/* You can add more navigation links here */}
                </nav>
            </div>
        </header>
    );
};

export default Header;