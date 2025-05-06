// app/components/ProductSearchAndDetails.js
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from './button'; // Adjust path relative to this component's location
import { Search, ChevronDown, ChevronUp, X, Edit } from 'lucide-react'; // Icons
import { toast } from 'sonner'; // Assuming you use Sonner

// Helper functions (copy these from your page file or create a separate helpers file if preferred)
function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

function parseDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
        return null;
    }
    const [day, month, year] = dateString.split('-');
     if (day && month && year && !isNaN(parseInt(day, 10)) && !isNaN(parseInt(month, 10)) && !isNaN(parseInt(year, 10))) {
         const dayInt = parseInt(day, 10);
         const monthInt = parseInt(month, 10);
         const yearInt = parseInt(year, 10);
         // Month is 0-indexed in Date constructor
         if (dayInt >= 1 && dayInt <= 31 && monthInt >= 1 && monthInt <= 12 && yearInt >= 1900 && yearInt <= 2100) {
             return new Date(yearInt, monthInt - 1, dayInt);
         }
     }
    return null; // Default to null if parsing fails
}

function parseMonthYearDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
        return null; // Return null for empty or invalid string
    }
    const parts = dateString.split('-');
    if (parts.length !== 2) {
        return null; // Must have exactly two parts (MM and YY)
    }
    const [month, year] = parts;
    const monthInt = parseInt(month, 10);
    const yearInt = parseInt(year, 10);

    if (month && year && !isNaN(monthInt) && !isNaN(yearInt)) {
        if (monthInt >= 1 && monthInt <= 12 && yearInt >= 0 && yearInt <= 99) {
            const fullYear = 2000 + yearInt; // Simple approach: assume 20xx
            return new Date(fullYear, monthInt - 1, 1); // Use day 1 for consistency
        }
    }
    return null; // Return null for invalid format or values
}


const ProductSearchAndDetails = ({ onEditProduct }) => { // Added prop for edit action if needed by parent
    // State for product master data
    const [products, setProducts] = useState([]);
    // State for purchase and sales bills (for stock calculation and history)
    const [purchaseBills, setPurchaseBills] = useState([]);
    const [salesBills, setSalesBills] = useState([]);

    // State for search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null); // The product whose details are displayed

    // State for managing expanded rows in batch/history tables
    const [expandedRows, setExpandedRows] = useState({}); // Use product ID as key for main row expansion

    // --- Data Loading from localStorage ---
    useEffect(() => {
        const loadData = () => {
            // Load products
            const storedProducts = localStorage.getItem('products');
            if (storedProducts) {
                try {
                    const parsedProducts = JSON.parse(storedProducts);
                    setProducts(parsedProducts);
                } catch (error) {
                    console.error("Error loading products from localStorage:", error);
                    setProducts([]);
                }
            } else {
                setProducts([]);
            }

            // Load purchase bills
            const storedPurchaseBills = localStorage.getItem('purchaseBills');
            if (storedPurchaseBills) {
                try {
                     const parsedBills = JSON.parse(storedPurchaseBills);
                     // Ensure numeric fields are numbers on load and include necessary fields for history
                    const processedBills = parsedBills.map(bill => ({
                        ...bill,
                        items: bill.items.map(item => ({
                            ...item,
                            quantity: Number(item.quantity) || 0,
                            ptr: Number(item.ptr) || 0,
                            itemsPerPack: Number(item.itemsPerPack) || 1,
                            batch: item.batch || '',
                            expiry: item.expiry || '',
                             supplierName: bill.supplierName || 'N/A',
                             purchaseDate: bill.date || 'N/A',
                            unit: item.unit || '',
                            mrp: Number(item.mrp) || 0,
                            discount: Number(item.discount) || 0,
                            taxRate: Number(item.taxRate) || 0,
                            totalItemAmount: Number(item.totalItemAmount) || 0,
                        }))
                    }));
                    setPurchaseBills(processedBills);
                } catch (error) {
                    console.error("Error loading purchase bills from localStorage:", error);
                    setPurchaseBills([]);
                }
            } else {
                setPurchaseBills([]);
            }

            // Load sales bills
            const storedSalesBills = localStorage.getItem('salesBills');
            if (storedSalesBills) {
                try {
                     const parsedBills = JSON.parse(storedSalesBills);
                     const processedBills = parsedBills.map(bill => ({
                         ...bill,
                         items: bill.items.map(item => ({
                             ...item,
                             quantitySold: Number(item.quantitySold) || 0,
                             product: item.product || '', // Ensure product name is present
                             batch: item.batch || '', // Ensure batch is present
                             expiry: item.expiry || '', // Ensure expiry is present
                         }))
                     }));
                    setSalesBills(processedBills);
                } catch (error) {
                    console.error("Error loading sales bills from localStorage:", error);
                    setSalesBills([]);
                }
            } else {
                setSalesBills([]);
            }
        };

        loadData(); // Initial load

        // Add event listeners for data updates from *anywhere*
        const handleDataUpdated = () => {
             console.log("ProductSearchAndDetails: Data updated event received. Reloading data.");
             loadData(); // Reload all necessary data
         };

         window.addEventListener('productsUpdated', handleDataUpdated);
         window.addEventListener('purchaseBillsUpdated', handleDataUpdated);
         window.addEventListener('salesBillsUpdated', handleDataUpdated); // Listen for sales updates

        return () => {
            // Clean up event listeners
            window.removeEventListener('productsUpdated', handleDataUpdated);
            window.removeEventListener('purchaseBillsUpdated', handleDataUpdated);
            window.removeEventListener('salesBillsUpdated', handleDataUpdated);
        };

    }, []); // Empty dependency array means this runs only once on mount


    // --- Stock Calculation Logic (Memoized) ---
    const batchStock = useMemo(() => {
        // console.log("ProductSearchAndDetails: Calculating batch stock..."); // Too chatty
        const stockMap = new Map(); // Map to hold { "ProductName_Batch_Expiry": quantity }

        // Process Purchases: Add quantities
        purchaseBills.forEach(bill => {
            bill.items.forEach(item => {
                if (item.product && typeof item.product === 'string' && item.batch && typeof item.batch === 'string' && item.expiry && typeof item.expiry === 'string') {
                     const key = `${item.product.trim().toLowerCase()}_${item.batch.trim().toLowerCase()}_${item.expiry.trim().toLowerCase()}`;
                     const quantity = Number(item.quantity) || 0;
                     stockMap.set(key, (stockMap.get(key) || 0) + quantity);
                }
            });
        });

        // Process Sales: Subtract quantities
        salesBills.forEach(bill => {
            bill.items.forEach(item => {
                if (item.product && typeof item.product === 'string' && item.batch && typeof item.batch === 'string' && item.expiry && typeof item.expiry === 'string') {
                     const key = `${item.product.trim().toLowerCase()}_${item.batch.trim().toLowerCase()}_${item.expiry.trim().toLowerCase()}`;
                     const quantitySold = Number(item.quantitySold) || 0;
                      stockMap.set(key, (stockMap.get(key) || 0) - quantitySold);
                }
            });
        });

        // Group stock by product name and format for display
        const productBatchStock = new Map(); // Map to hold { "OriginalProductName": [{ batch, expiry, quantity }] }

        stockMap.forEach((quantity, key) => {
            const parts = key.split('_');
             if (parts.length !== 3) return;
            const [productNameLower, batchLower, expiryLower] = parts;

            const originalProduct = products.find(p => p && typeof p.name === 'string' && p.name.toLowerCase() === productNameLower);
            if (!originalProduct) return;

             if (!productBatchStock.has(originalProduct.name)) {
                  productBatchStock.set(originalProduct.name, []);
              }

            if (quantity > 0) {
                 let displayBatch = batchLower;
                 let displayExpiry = expiryLower;
                   const purchaseItemMatch = purchaseBills.flatMap(bill => bill.items).find(item =>
                       item.product && typeof item.product === 'string' && item.product.trim().toLowerCase() === productNameLower &&
                       item.batch && typeof item.batch === 'string' && item.batch.trim().toLowerCase() === batchLower &&
                       item.expiry && typeof item.expiry === 'string' && item.expiry.trim().toLowerCase() === expiryLower
                   );
                   if (purchaseItemMatch) {
                       displayBatch = purchaseItemMatch.batch.trim();
                       displayExpiry = purchaseItemMatch.expiry.trim();
                   }

                 const batches = productBatchStock.get(originalProduct.name);
                 if (Array.isArray(batches)) {
                    batches.push({
                        batch: displayBatch,
                        expiry: displayExpiry,
                        quantity: quantity,
                    });
                }
            }
        });

         // Sort batches by expiry date within each product
         productBatchStock.forEach(batches => {
              if (Array.isArray(batches)) {
                  batches.sort((a, b) => {
                      const dateA = parseMonthYearDate(a.expiry);
                      const dateB = parseMonthYearDate(b.expiry);
                      if (!dateA && !dateB) return 0;
                      if (!dateA) return 1;
                      if (!dateB) return -1;
                      return dateA - dateB;
                  });
              }
          });

        // console.log("ProductSearchAndDetails: Batch stock calculated.", Object.fromEntries(productBatchStock)); // Too chatty
        return productBatchStock;

    }, [products, purchaseBills, salesBills]);


    // Function to get total stock for a product name
    const getTotalStock = (productName) => {
        const originalProduct = products.find(p => p && typeof p.name === 'string' && p.name.toLowerCase() === productName?.toLowerCase());
        if (!originalProduct) return 0;
        const batches = batchStock.get(originalProduct.name) || [];
        return batches.reduce((sum, batch) => sum + batch.quantity, 0);
    };


     // --- Function to find Last Purchase Details for a Specific Batch (Memoized) ---
     const getLastPurchaseDetails = useCallback((productName, batch, expiry) => {
         const matchingItems = purchaseBills.flatMap(bill => bill.items).filter(item =>
             item.product && typeof item.product === 'string' && item.product.trim().toLowerCase() === productName?.trim().toLowerCase() &&
             item.batch && typeof item.batch === 'string' && item.batch.trim().toLowerCase() === batch?.trim().toLowerCase() &&
             item.expiry && typeof item.expiry === 'string' && item.expiry.trim().toLowerCase() === expiry?.trim().toLowerCase()
         );

         if (matchingItems.length === 0) {
             return null;
         }

         matchingItems.sort((a, b) => {
             const dateA = parseDate(a.purchaseDate);
             const dateB = parseDate(b.purchaseDate);
             if (!dateA && !dateB) return 0;
             if (!dateA) return 1;
             if (!dateB) return -1;
             return dateB - dateA;
         });

         const latestPurchase = matchingItems[0];

         return {
             supplierName: latestPurchase.supplierName || 'N/A',
             purchaseDate: latestPurchase.purchaseDate || 'N/A',
             ptr: Number(latestPurchase.ptr) || 0,
             itemsPerPack: Number(latestPurchase.itemsPerPack) || 1,
              mrp: Number(latestPurchase.mrp) || 0, // Include MRP from purchase record
              taxRate: Number(latestPurchase.taxRate) || 0, // Include Tax Rate from purchase record
              discount: Number(latestPurchase.discount) || 0, // Include Discount from purchase record
              totalItemAmount: Number(latestPurchase.totalItemAmount) || 0, // Include calculated amount
         };
     }, [purchaseBills, parseDate]);


    // --- Search and Selection Handlers ---

    // Handle search input change
    const handleSearchChange = (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        // Clear selected product and results if query is empty
         if (!query || query.length < 2) { // Require at least 2 chars to search
             setSearchResults([]);
             setSelectedProduct(null); // Clear details area
             setExpandedRows({}); // Collapse rows
             return;
         }


        const lowerQuery = query.toLowerCase();
        const filtered = products.filter(product =>
             product && typeof product.name === 'string' && ( // Add safety checks
                product.name.toLowerCase().includes(lowerQuery) ||
                (typeof product.unit === 'string' && product.unit.toLowerCase().includes(lowerQuery)) ||
                (typeof product.category === 'string' && product.category.toLowerCase().includes(lowerQuery)) ||
                (typeof product.company === 'string' && product.company.toLowerCase().includes(lowerQuery))
            )
        );
        setSearchResults(filtered.slice(0, 10)); // Limit number of results displayed
    };

    // Handle selecting a product from search results
    const handleSelectProduct = (product) => {
        setSearchQuery(product.name); // Put the selected name in the search box
        setSelectedProduct(product); // Set the selected product to display details
        setSearchResults([]); // Clear search results list
        setExpandedRows({}); // Collapse any previously expanded rows

        // Optional: Automatically expand the batch details for the selected product
        // setExpandedRows({ [product.id]: true });
    };

    // Function to clear the selected product and search
    const handleClearSearch = () => {
         setSearchQuery('');
         setSearchResults([]);
         setSelectedProduct(null); // Clear details area
         setExpandedRows({}); // Collapse rows
    };

    // Function to toggle expansion of a product row (for batch details)
     const toggleRowExpansion = (productId) => {
          setExpandedRows(prevExpandedRows => ({
              ...prevExpandedRows,
              [productId]: !prevExpandedRows[productId],
          }));
      };


    // --- Rendered JSX ---
    return (
        <div className="border p-4 rounded-lg bg-gray-50"> {/* Container for the component */}
             <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-semibold flex items-center"><Search className="mr-2 h-5 w-5"/> Product Search & Details</h3>
                 {selectedProduct && ( // Show clear button only if a product is selected
                     <Button size="sm" onClick={handleClearSearch} className="bg-red-500 hover:bg-red-600 text-white p-1 rounded-full" title="Clear Search & Details"><X className="h-4 w-4" /></Button>
                 )}
             </div>

            <div className="relative w-full mb-4">
                <input
                    type="text"
                    placeholder="Search product name, category, or company..."
                    className="border p-2 rounded w-full"
                    value={searchQuery}
                    onChange={handleSearchChange}
                />
                 {/* Optional: Clear button inside the input */}
                 {searchQuery && !selectedProduct && ( // Show clear button while typing, but not if a product is selected (use the clear button above)
                      <button
                          onClick={() => setSearchQuery('')} // Only clears the query, not selected product
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                          <X className="h-4 w-4" />
                      </button>
                  )}
            </div>

            {/* Display Search Results (as a simple list below the input) */}
            {searchQuery && searchResults.length > 0 && !selectedProduct && ( // Only show if query exists, results found, and no product selected
                <ul className="border border-gray-300 rounded mt-2 max-h-40 overflow-y-auto bg-white z-10 absolute w-[calc(100%-3rem)]"> {/* Position absolutely and give a Z-index */}
                    {searchResults.map(product => (
                        <li
                            key={product.id}
                            className="p-2 border-b border-gray-200 hover:bg-blue-50 cursor-pointer text-sm truncate" // Truncate long names
                            onClick={() => handleSelectProduct(product)}
                        >
                            {product.name} ({product.company})
                        </li>
                    ))}
                </ul>
            )}

            {/* --- Product Details Display --- */}
            {selectedProduct && (
                 <div className="mt-6 border p-4 rounded-lg bg-white shadow-sm">
                      <h4 className="text-lg font-semibold mb-3">Details for "{selectedProduct.name}"</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                            <p><strong>Unit:</strong> {selectedProduct.unit}</p>
                            <p><strong>Category:</strong> {selectedProduct.category}</p>
                            <p><strong>Company:</strong> {selectedProduct.company}</p>
                            <p><strong>MRP (per Item):</strong> ₹{Number(selectedProduct.mrp).toFixed(2)}</p>
                            <p><strong>Items per Pack (Master):</strong> {selectedProduct.itemsPerPack}</p>
                            <p><strong>Min Stock (Items):</strong> {selectedProduct.minStock}</p>
                            <p><strong>Max Stock (Items):</strong> {selectedProduct.maxStock}</p>
                            <p><strong>Default Discount (%):</strong> {selectedProduct.discount}%</p>
                            <p><strong>Tax Rate (%):</strong> {selectedProduct.taxRate}%</p>
                             <p className="col-span-full font-bold text-base">
                                <strong>Total Current Stock (Items):</strong> {getTotalStock(selectedProduct.name)}
                             </p>
                       </div>

                       {/* Batch Stock Details - Expandable Section */}
                       <div className="mb-4">
                           <h5 className="font-semibold mb-2 cursor-pointer flex items-center" onClick={() => toggleRowExpansion(selectedProduct.id)}>
                                Batch Stock Breakdown:
                                {expandedRows[selectedProduct.id] ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
                           </h5>

                           {expandedRows[selectedProduct.id] && (
                                <div className="overflow-x-auto mt-2">
                                     {batchStock.has(selectedProduct.name) && Array.isArray(batchStock.get(selectedProduct.name)) && batchStock.get(selectedProduct.name).length > 0 ? (
                                         <table className="min-w-full table-auto border-collapse border border-gray-200 text-xs">
                                              <thead>
                                                  <tr className="bg-gray-100 text-left">
                                                      <th className="border border-gray-200 px-2 py-1">Batch No.</th>
                                                      <th className="border border-gray-200 px-2 py-1">Expiry (MM-YY)</th>
                                                      <th className="border border-gray-200 px-2 py-1">Stock (Items)</th>
                                                      <th className="border border-gray-200 px-2 py-1">Last Purchased From</th>
                                                      <th className="border border-gray-200 px-2 py-1">Last Purchase Date</th>
                                                      <th className="border border-gray-200 px-2 py-1">Last PTR/Pack</th>
                                                      <th className="border border-gray-200 px-2 py-1">Items/Pack (on Purchase)</th>
                                                       {/* Add headers for MRP, Tax, Discount, Item Value if desired here too */}
                                                  </tr>
                                              </thead>
                                              <tbody>
                                                  {batchStock.get(selectedProduct.name)
                                                      .map((batchDetail, batchIndex) => {
                                                            const lastPurchase = getLastPurchaseDetails(selectedProduct.name, batchDetail.batch, batchDetail.expiry);
                                                          return (
                                                              <tr key={batchIndex} className="hover:bg-gray-50">
                                                                  <td className="border border-gray-200 px-2 py-1">{batchDetail.batch}</td>
                                                                  <td className="border border-gray-200 px-2 py-1">{batchDetail.expiry}</td>
                                                                  <td className="border border-gray-200 px-2 py-1 font-medium">{batchDetail.quantity}</td>
                                                                  <td className="border border-gray-200 px-2 py-1">{lastPurchase ? lastPurchase.supplierName : 'N/A'}</td>
                                                                  <td className="border border-gray-200 px-2 py-1">{lastPurchase ? lastPurchase.purchaseDate : 'N/A'}</td>
                                                                  <td className="border border-gray-200 px-2 py-1">{lastPurchase ? `₹${Number(lastPurchase.ptr).toFixed(2)}` : 'N/A'}</td>
                                                                  <td className="border border-gray-200 px-2 py-1">{lastPurchase ? lastPurchase.itemsPerPack : 'N/A'}</td>
                                                              </tr>
                                                          );
                                                      })
                                                  }
                                              </tbody>
                                          </table>
                                      ) : (
                                           <p className="text-gray-600 text-sm">No batch details available or zero stock batches for this product.</p>
                                      )}
                                </div>
                           )}
                       </div>

                        {/* Optional: Button to trigger editing this product in Product Master */}
                        {/* Ensure onEditProduct prop is passed and handled by the parent page */}
                        {/* {onEditProduct && (
                             <div className="flex justify-end">
                                 <Button onClick={() => onEditProduct(selectedProduct)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm">
                                     <Edit className="mr-2 h-4 w-4"/> Edit in Product Master
                                 </Button>
                             </div>
                         )} */}

                 </div>
             )}

        </div>
    );
};

export default ProductSearchAndDetails;