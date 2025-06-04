// app/customer/page.js
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '../components/button';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import { toast } from 'sonner';
import {
    Plus, Trash2, Edit, Save, Search, RefreshCcw, ArrowDownUp, ChevronLeft, ChevronRight,
    User, Phone, Mail, MapPin
} from 'lucide-react';

// Import Firebase services
import { db, auth, initializeFirebaseAndAuth } from '../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const CustomerMasterPage = () => {
    const router = useRouter();

    const [customers, setCustomers] = useState([]);
    const [currentCustomer, setCurrentCustomer] = useState({
        id: null,
        name: '',
        phone: '',
        email: '',
        address: '',
    });
    const [editingCustomerId, setEditingCustomerId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // State for Sorting
    const [sortColumn, setSortColumn] = useState('name');
    const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

    // State for Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [customersPerPage] = useState(10); // Number of customers per page

    // Firebase specific states
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Get the app ID, with a fallback for environments where it might not be defined
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // --- Initial Firebase Setup and Authentication Listener ---
    useEffect(() => {
        const setupFirebase = async () => {
            await initializeFirebaseAndAuth();

            const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    console.log("CustomerMasterPage: Auth state changed, user ID:", user.uid);
                } else {
                    setUserId(null);
                    console.log("CustomerMasterPage: Auth state changed, no user (anonymous or logged out).");
                }
                setIsAuthReady(true);
            });

            return () => {
                unsubscribeAuth();
            };
        };

        setupFirebase();
    }, []);

    // --- Data Loading from Firestore using onSnapshot ---
    useEffect(() => {
        if (!isAuthReady || !userId) return;

        console.log("CustomerMasterPage Firestore: Setting up customers snapshot listener...");
        const customersCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/customers`);
        const unsubscribe = onSnapshot(customersCollectionRef, (snapshot) => {
            const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCustomers(customersData);
            setLoading(false);
            console.log("CustomerMasterPage Firestore: Customers data loaded.");
        }, (error) => {
            console.error("CustomerMasterPage Firestore Error:", error);
            setError("Error loading customer data from cloud.");
            setLoading(false);
            toast.error("Error loading customer data.");
        });

        return () => unsubscribe();
    }, [isAuthReady, userId, appId]);

    // Handle form input changes
    const handleChange = (e) => {
        const { name, value } = e.target;
        setCurrentCustomer(prev => ({ ...prev, [name]: value }));
    };

    // Save or Update a Customer
    const handleSaveCustomer = async () => {
        if (!userId) {
            toast.error("User not authenticated. Cannot save customer.");
            return;
        }
        if (!currentCustomer.name.trim() || !currentCustomer.phone.trim()) {
            toast.error('Name and Phone are required.');
            return;
        }

        try {
            const customersCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/customers`);
            if (editingCustomerId) {
                await updateDoc(doc(customersCollectionRef, editingCustomerId), currentCustomer);
                toast.success(`Customer "${currentCustomer.name}" updated successfully!`);
            } else {
                await addDoc(customersCollectionRef, currentCustomer);
                toast.success(`Customer "${currentCustomer.name}" added successfully!`);
            }
            handleClearForm();
        } catch (e) {
            console.error("Error saving customer to Firestore: ", e);
            toast.error("Failed to save customer to Firestore.");
        }
    };

    // Edit a Customer
    const handleEditCustomer = (customer) => {
        setEditingCustomerId(customer.id);
        setCurrentCustomer(customer);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Delete a Customer
    const handleDeleteCustomer = async (id, name) => {
        if (!userId) {
            toast.error("User not authenticated. Cannot delete customer.");
            return;
        }
        toast.info(`Deleting customer "${name}"...`, { duration: 1000 });

        try {
            const customersCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/customers`);
            await deleteDoc(doc(customersCollectionRef, id));
            toast.success(`Customer "${name}" deleted successfully.`);
        } catch (e) {
            console.error("Error deleting customer from Firestore: ", e);
            toast.error("Failed to delete customer from Firestore.");
        }
    };

    // Clear the form
    const handleClearForm = () => {
        setEditingCustomerId(null);
        setCurrentCustomer({
            id: null,
            name: '',
            phone: '',
            email: '',
            address: '',
        });
        toast.info('Customer form cleared.');
    };

    // Memoized filtered and sorted customers for display
    const filteredAndSortedCustomers = useMemo(() => {
        let filtered = customers.filter(customer =>
            customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            customer.phone.includes(searchQuery) ||
            (customer.email && customer.email.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        if (sortColumn) {
            filtered.sort((a, b) => {
                const aValue = String(a[sortColumn] || '').toLowerCase();
                const bValue = String(b[sortColumn] || '').toLowerCase();

                if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [customers, searchQuery, sortColumn, sortDirection]);

    // Pagination logic
    const indexOfLastCustomer = currentPage * customersPerPage;
    const indexOfFirstCustomer = indexOfLastCustomer - customersPerPage;
    const currentFilteredAndSortedCustomers = useMemo(() => {
        return filteredAndSortedCustomers.slice(indexOfFirstCustomer, indexOfLastCustomer);
    }, [filteredAndSortedCustomers, indexOfFirstCustomer, indexOfLastCustomer]);

    const totalPages = Math.ceil(filteredAndSortedCustomers.length / customersPerPage);

    const paginate = (pageNumber) => {
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
        setCurrentPage(1); // Reset to first page on sort
    };

    if (loading || !isAuthReady) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="loader"></div>
                <p className="ml-4 text-gray-700">Loading data and authenticating...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-screen text-red-600">
                <p>{error}</p>
            </div>
        );
    }

    return (
        <>
            <Header />
            <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 bg-gray-100 rounded-lg shadow-inner fade-in">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-800">Customer Master</h2>
                    <Button
                        onClick={() => router.push('/')}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                    >
                        Go to Dashboard
                    </Button>
                </div>

                {/* Display User ID (MANDATORY for multi-user apps) */}
                {userId && (
                    <div className="mb-4 p-3 bg-gray-200 rounded-md text-sm text-gray-700">
                        <span className="font-semibold">Current User ID:</span> {userId}
                    </div>
                )}

                {/* Customer Form */}
                <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
                    <h3 className="text-2xl font-semibold text-gray-700 mb-4 border-b pb-3 border-gray-200">
                        {editingCustomerId ? 'Edit Customer' : 'Add New Customer'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                                    <User className="h-5 w-5 text-gray-400" />
                                </span>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={currentCustomer.name}
                                    onChange={handleChange}
                                    placeholder="e.g., Jane Doe"
                                    className="pl-10 mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                                    <Phone className="h-5 w-5 text-gray-400" />
                                </span>
                                <input
                                    type="text"
                                    id="phone"
                                    name="phone"
                                    value={currentCustomer.phone}
                                    onChange={handleChange}
                                    placeholder="e.g., +91 9876543210"
                                    className="pl-10 mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </span>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={currentCustomer.email}
                                    onChange={handleChange}
                                    placeholder="e.g., jane@example.com"
                                    className="pl-10 mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                        </div>
                        <div className="lg:col-span-full">
                            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Address (Optional)</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                                    <MapPin className="h-5 w-5 text-gray-400" />
                                </span>
                                <textarea
                                    id="address"
                                    name="address"
                                    value={currentCustomer.address}
                                    onChange={handleChange}
                                    rows="2"
                                    placeholder="e.g., 456 Oak Ave, Town, State, Zip"
                                    className="pl-10 mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                ></textarea>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <Button
                            onClick={handleClearForm}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                        >
                            <RefreshCcw className="mr-2 h-4 w-4" /> Clear Form
                        </Button>
                        <Button
                            onClick={handleSaveCustomer}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                        >
                            <Save className="mr-2 h-4 w-4" /> {editingCustomerId ? 'Update Customer' : 'Add Customer'}
                        </Button>
                    </div>
                </div>

                {/* Customers List */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-semibold text-gray-700">Existing Customers</h3>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search customers..."
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm w-full md:w-64"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors duration-150"
                                        onClick={() => handleSort('name')}
                                    >
                                        Customer Name
                                        {sortColumn === 'name' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors duration-150"
                                        onClick={() => handleSort('phone')}
                                    >
                                        Phone
                                        {sortColumn === 'phone' && (
                                            sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />
                                        )}
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {currentFilteredAndSortedCustomers.length > 0 ? (
                                    currentFilteredAndSortedCustomers.map((customer) => (
                                        <tr key={customer.id} className="hover:bg-gray-100 transition duration-100 ease-in-out">
                                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{customer.name}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{customer.phone}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{customer.email || '-'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{customer.address || '-'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center space-x-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleEditCustomer(customer)}
                                                        className="p-2 rounded-full bg-yellow-100 hover:bg-yellow-200 text-yellow-700 transition-colors duration-200"
                                                        title="Edit Customer"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                                                        className="p-2 rounded-full bg-red-100 hover:bg-red-200 text-red-700 transition-colors duration-200"
                                                        title="Delete Customer"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-3 py-4 text-center text-sm text-gray-500">
                                            {searchQuery ? "No customers match your search." : "No customers added yet."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="mt-4 flex justify-between items-center">
                        <Button
                            onClick={() => paginate(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                        </Button>
                        <span className="text-sm text-gray-700">
                            Page {currentPage} of {totalPages}
                        </span>
                        <Button
                            onClick={() => paginate(currentPage + 1)}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>

                    {currentFilteredAndSortedCustomers.length === 0 && customers.length > 0 && searchQuery && (
                        <p className="text-center text-gray-500 mt-4">No customers match your current search query.</p>
                    )}
                    {currentFilteredAndSortedCustomers.length === 0 && customers.length > 0 && !searchQuery && (
                        <p className="text-center text-gray-500 mt-4">No customers available after filtering/sorting.</p>
                    )}
                </div>
            </div>

            <style jsx>{`
                .fade-in {
                    animation: fadeIn 0.5s ease-out forwards;
                    opacity: 0;
                }
                @keyframes fadeIn {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .loader {
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
};

export default CustomerMasterPage;
