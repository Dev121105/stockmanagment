"use client";
import React, { useState, useEffect } from 'react';
// Reverting to './firebase' as the import path. This assumes firebase.js
// is in the same directory as this page.js file, or that it's
// directly accessible at this relative path by the build system.
import { db, auth, initializeFirebaseAndAuth } from '../lib/firebase'; 
import { collection, onSnapshot, query } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Header from '../components/Header';

// Helper function to calculate profit and margin
const calculateProfitAndMargin = (ptr, mrp) => {
  // Ensure inputs are valid numbers
  const purchasePrice = parseFloat(ptr);
  const retailPrice = parseFloat(mrp);

  if (isNaN(purchasePrice) || isNaN(retailPrice) || retailPrice <= 0) {
    return { profit: null, margin: null };
  }

  const profit = retailPrice - purchasePrice;
  const margin = (profit / retailPrice) * 100;

  return { profit, margin };
};

const ProfitMarginCalculatorPage = () => {
  // State for the single product calculator
  const [singlePtr, setSinglePtr] = useState('');
  const [singleMrp, setSingleMrp] = useState('');
  const [singleResult, setSingleResult] = useState({ profit: null, margin: null });

  // State for available products fetched from Firestore
  const [availableProducts, setAvailableProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Initialize Firebase and set up auth state listener
  useEffect(() => {
    const init = async () => {
      // Ensure Firebase is initialized and auth attempted
      // This will also handle anonymous sign-in if no custom token is present
      await initializeFirebaseAndAuth();
      onAuthStateChanged(auth, (user) => {
        if (user) {
          setUserId(user.uid);
          console.log("Authenticated user ID:", user.uid);
        } else {
          // If no user is logged in and not signed in anonymously, use a random ID.
          // In a real app, you might force login or explicitly sign in anonymously here.
          setUserId(crypto.randomUUID());
          console.log("No authenticated user, using random user ID.");
        }
        setIsAuthReady(true); // Auth state is ready
      });
    };
    init();
  }, []);

  // Fetch products from Firestore when auth is ready and userId is set
  useEffect(() => {
    // Only attempt to fetch if authentication state is ready, userId is available, and db is initialized
    if (!isAuthReady || !userId || !db) {
      console.log("Firestore fetch deferred: isAuthReady =", isAuthReady, "userId =", userId, "db =", db);
      return;
    }

    setLoading(true);
    setError(null);

    // Determine the app ID. This is MANDATORY for Firestore paths in the Canvas environment.
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    // Construct the collection path for the user's private products data
    const productsCollectionPath = `/artifacts/${appId}/users/${userId}/products`;
    console.log("Attempting to fetch from Firestore path:", productsCollectionPath);

    // Create a query to the 'products' collection under the user's private path
    const productsQuery = query(collection(db, productsCollectionPath));

    // Set up a real-time listener for the products collection
    // onSnapshot provides real-time updates whenever data changes in Firestore
    const unsubscribe = onSnapshot(productsQuery,
      (snapshot) => {
        // Map the document data to an array of product objects, including the document ID
        const productsData = snapshot.docs.map(doc => ({
          id: doc.id, // Include the document ID for React key prop and potential future updates
          ...doc.data(), // Spread all other document data
          // Ensure ptr and mrp are numbers, defaulting to 0 if undefined or null
          ptr: Number(doc.data().ptr) || 0,
          mrp: Number(doc.data().mrp) || 0,
        }));
        setAvailableProducts(productsData); // Update the state with fetched products
        setLoading(false); // Set loading to false once data is fetched
        console.log("Products fetched from Firestore:", productsData);
      },
      (err) => {
        // Handle any errors during the Firestore fetch operation
        console.error("Error fetching products from Firestore:", err);
        setError("Failed to load products. Please try again."); // User-friendly error message
        setLoading(false); // Set loading to false on error
      }
    );

    // Clean up the listener when the component unmounts or dependencies change
    // This prevents memory leaks and ensures listeners are properly managed
    return () => unsubscribe();
  }, [isAuthReady, userId]); // Re-run this effect when authentication state or userId changes

  // Handle calculation for the single product
  const handleSingleCalculate = () => {
    const result = calculateProfitAndMargin(singlePtr, singleMrp);
    setSingleResult(result);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 bg-gray-100 min-h-screen rounded-lg shadow-lg">
      <Header/>
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800 mt-5">Profit and Margin Calculator</h1>
      <p className="text-sm text-center text-gray-600 mb-4">
        Your User ID (for data storage): <span className="font-mono bg-gray-200 px-2 py-1 rounded">{userId || 'Loading...'}</span>
      </p>

      {/* Single Product Calculator Section */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Calculate for a Single Product</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label htmlFor="ptr" className="block text-sm font-medium text-gray-700 mb-1">Purchase Tax Rate (PTR)</label>
            <input
              type="number"
              id="ptr"
              value={singlePtr}
              onChange={(e) => setSinglePtr(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter PTR"
            />
          </div>
          <div>
            <label htmlFor="mrp" className="block text-sm font-medium text-gray-700 mb-1">Maximum Retail Price (MRP)</label>
            <input
              type="number"
              id="mrp"
              value={singleMrp}
              onChange={(e) => setSingleMrp(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter MRP"
            />
          </div>
        </div>
        <button
          onClick={handleSingleCalculate}
          className="w-full md:w-auto px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
        >
          Calculate
        </button>

        {singleResult.profit !== null && (
          <div className="mt-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
            <p className="font-semibold">Calculated Results:</p>
            <p>Profit: <span className="font-bold">{singleResult.profit.toFixed(2)}</span></p>
            <p>Margin: <span className="font-bold">{singleResult.margin.toFixed(2)}%</span></p>
          </div>
        )}
      </div>

      {/* Available Products Section */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Available Products Profit/Margin</h2>
        {loading && <p className="text-center text-gray-600">Loading products from database...</p>}
        {error && <p className="text-center text-red-600">{error}</p>}
        {!loading && !error && availableProducts.length === 0 && (
          <p className="text-center text-gray-600">No products found in the database. Add some products to see them here!</p>
        )}
        {!loading && !error && availableProducts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PTR
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MRP
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Profit
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Margin (%)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {availableProducts.map((product) => {
                  const { profit, margin } = calculateProfitAndMargin(product.ptr, product.mrp);
                  return (
                    <tr key={product.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.ptr !== undefined ? product.ptr.toFixed(2) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.mrp !== undefined ? product.mrp.toFixed(2) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {profit !== null ? profit.toFixed(2) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {margin !== null ? margin.toFixed(2) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfitMarginCalculatorPage;
