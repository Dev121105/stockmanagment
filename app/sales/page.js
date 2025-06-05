// app/sales/page.js
"use client"; // This directive is needed for client-side functionality

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '../components/button';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import { toast } from 'sonner';
import {
    Trash2, Eye, Plus, X, Edit, Save, Search, RefreshCcw, AlertTriangle,
    ChevronDown, ChevronUp, ArrowDownUp, ChevronLeft, ChevronRight // Added missing icons for sorting and pagination
} from 'lucide-react';

// Import Firebase services
import { db, auth, initializeFirebaseAndAuth } from '../lib/firebase'; // Adjust path as needed
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged 
} from 'firebase/auth';

// Helper function to format date as DD-MM-YYYY
function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

// Helper function to parse DD-MM-YYYY string to Date
function parseDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
        return null;
    }
    const [day, month, year] = dateString.split('-');
     if (day && month && year && !isNaN(parseInt(day, 10)) && !isNaN(parseInt(month, 10)) && !isNaN(parseInt(year, 10))) {
        const dayInt = parseInt(day, 10);
        const monthInt = parseInt(month, 10);
        const yearInt = parseInt(year, 10);
        // Month is 0-indexed in JavaScript Date object
        const date = new Date(yearInt, monthInt - 1, dayInt);
        // Check if the parsed date is valid and matches the input components
        if (date.getFullYear() === yearInt && date.getMonth() === monthInt - 1 && date.getDate() === dayInt) {
            return date;
        }
    }
    console.warn(`Invalid date string for parsing: ${dateString}`);
    return null;
}

// Helper function to parse MM-YYYY string to Date (for expiry)
function parseMonthYearDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
        return null;
    }
    const [month, year] = dateString.split('-');
    if (month && year && !isNaN(parseInt(month, 10)) && !isNaN(parseInt(year, 10))) {
        const monthInt = parseInt(month, 10);
        const yearInt = parseInt(year, 10);
        // For expiry, set to the last day of the month for accurate comparison
        const date = new Date(yearInt, monthInt, 0); // Day 0 of next month gives last day of current month
        if (date.getFullYear() === yearInt && date.getMonth() === monthInt - 1) { // Check if month is correct
            return date;
        }
    }
    console.warn(`Invalid month-year date string for parsing: ${dateString}`);
    return null;
}

const SalesPage = () => {
    const router = useRouter();

    const [sales, setSales] = useState([]);
    const [currentSale, setCurrentSale] = useState({
        id: null,
        customerName: '',
        saleDate: formatDate(new Date()),
        items: [],
        subTotal: 0,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 0,
        paidAmount: '',
        balanceAmount: 0,
        paymentMethod: 'Cash',
        notes: '',
    });
    const [products, setProducts] = useState([]); // All products from master
    const [purchaseBills, setPurchaseBills] = useState([]); // All purchase bills
    const [salesBills, setSalesBills] = useState([]); // All sales bills (for stock calculation)

    const [searchQuery, setSearchQuery] = useState('');
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [currentSaleItem, setCurrentSaleItem] = useState({
        productId: '',
        productName: '',
        unit: '',
        category: '',
        batch: '',
        expiry: '',
        quantity: '',
        mrp: '',
        salePrice: '',
        discount: '',
        taxRate: '',
        itemSubtotal: 0,
        itemDiscountAmount: 0,
        itemTaxAmount: 0,
        itemTotal: 0,
        hsn: '',
        schedule: '',
        barcode: '',
        selectedPriceType: 'salePrice', // New state to track selected price type
    });
    const [editingSaleId, setEditingSaleId] = useState(null);
    const [expandedSaleId, setExpandedSaleId] = useState(null);
    const [isProductListVisible, setIsProductListVisible] = useState(false);
    const productSearchRef = useRef(null);
    

    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingSale, setViewingSale] = useState(null); // Changed to null
    const viewModalRef = useRef(null); // Ref for the view modal content

    // State for Sorting
    const [sortColumn, setSortColumn] = useState('saleDate');
    const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'

    // State for Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [salesPerPage] = useState(10); // Number of sales per page

    // Firebase specific states
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [loading, setLoading] = useState(true); // Added loading state for Firebase data
    const [error, setError] = useState(null); // Added error state for Firebase data

    // Get the app ID, with a fallback for environments where it might not be defined
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // Refs for latest state in useCallback functions (still useful for immediate access)
    const productsRef = useRef(products);
    const purchaseBillsRef = useRef(purchaseBills);
    const salesBillsRef = useRef(salesBills);

    useEffect(() => { productsRef.current = products; }, [products]);
    useEffect(() => { purchaseBillsRef.current = purchaseBills; }, [purchaseBills]);
    useEffect(() => { salesBillsRef.current = salesBills; }, [salesBills]);

    // --- Initial Firebase Setup and Authentication Listener ---
    useEffect(() => {
        const setupFirebase = async () => {
            await initializeFirebaseAndAuth(); // Initialize Firebase and sign in

            // Set up auth state observer
            const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    console.log("SalesPage: Auth state changed, user ID:", user.uid);
                } else {
                    setUserId(null);
                    console.log("SalesPage: Auth state changed, no user (anonymous or logged out).");
                }
                setIsAuthReady(true); // Auth state has been determined (even if null)
            });

            return () => {
                unsubscribeAuth(); // Clean up auth listener on unmount
            };
        };

        setupFirebase();
    }, []); // Run only once on component mount

    // --- Data Loading from Firestore using onSnapshot ---

    // Load Products Data from Firestore
    useEffect(() => {
        if (!isAuthReady || !userId) return; // Wait for authentication to be ready

        console.log("SalesPage Firestore: Setting up products snapshot listener...");
        const productsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/products`);
        const unsubscribe = onSnapshot(productsCollectionRef, (snapshot) => {
            const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const processedProducts = productsData.map(p => ({
                ...p,
                mrp: Number(p.mrp) || 0,
                salePrice: Number(p.salePrice) || 0,
                quantity: Number(p.quantity) || 0,
                packSize: Number(p.itemsPerPack) || 1, // FIX: Ensure packSize is set from p.itemsPerPack
            }));
            setProducts(processedProducts);
            setLoading(false); // Set loading to false once products are loaded
            console.log("SalesPage Firestore: Products data loaded.");
        }, (error) => {
            console.error("SalesPage Firestore Products Error:", error);
            setError("Error loading product data from cloud.");
            setLoading(false);
            toast.error("Error loading product data.");
        });

        return () => unsubscribe();
    }, [isAuthReady, userId, appId]); // Added appId to dependency array

    // Load Purchase Bills Data from Firestore
    useEffect(() => {
        if (!isAuthReady || !userId) return;

        console.log("SalesPage Firestore: Setting up purchase bills snapshot listener...");
        const purchaseBillsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
        const unsubscribe = onSnapshot(purchaseBillsCollectionRef, (snapshot) => {
            const bills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const processedBills = bills.map(bill => ({
                ...bill,
                date: bill.date || '',
                items: bill.items.map(item => ({
                    ...item,
                    quantity: Number(item.quantity) || 0,
                    ptr: Number(item.ptr) || 0,
                    mrp: Number(item.mrp) || 0,
                    discount: Number(item.discount) || 0,
                    taxRate: Number(item.taxRate) || 0,
                    totalItemAmount: Number(item.totalItemAmount) || 0,
                })),
                totalAmount: Number(bill.totalAmount) || 0,
            }));
            setPurchaseBills(processedBills);
            console.log("SalesPage Firestore: Purchase bills data loaded.");
        }, (error) => {
            console.error("SalesPage Firestore Purchase Bills Error:", error);
            setError("Error loading purchase bill data from cloud.");
            toast.error("Error loading purchase bills.");
        });

        return () => unsubscribe();
    }, [isAuthReady, userId, appId]); // Added appId to dependency array

    // Load Sales Bills Data from Firestore
    useEffect(() => {
        if (!isAuthReady || !userId) return;

        console.log("SalesPage Firestore: Setting up sales snapshot listener...");
        const salesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/sales`);
        const unsubscribe = onSnapshot(salesCollectionRef, (snapshot) => {
            const bills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const processedBills = bills.map(bill => ({
                ...bill,
                items: bill.items.map(item => ({
                    ...item,
                    quantity: Number(item.quantity) || 0,
                    salePrice: Number(item.salePrice) || 0,
                    discount: Number(item.discount) || 0,
                    taxRate: Number(item.taxRate) || 0,
                    itemTotal: Number(item.itemTotal) || 0,
                }))
            }));
            setSales(processedBills); // Update the main 'sales' state
            setSalesBills(processedBills); // Also update 'salesBills' for stock calculation
            console.log("SalesPage Firestore: Sales bills data loaded.");
        }, (error) => {
            console.error("SalesPage Firestore Sales Bills Error:", error);
            setError("Error loading sales bills from cloud.");
            toast.error("Error loading sales bills.");
        });

        return () => unsubscribe();
    }, [isAuthReady, userId, appId]); // Added appId to dependency array


    // Data update event listener (still useful for other pages to trigger re-renders)
    // This listener will now cause the Firestore onSnapshot listeners to re-evaluate,
    // effectively reloading data if underlying data changes (e.g., from other tabs).
    useEffect(() => {
        const handleDataUpdated = () => {
            console.log("SalesPage: Data update event received. Firestore listeners will handle reload.");
            // The onSnapshot listeners above will automatically update state when data changes in Firestore.
            // No explicit load functions needed here anymore, just a log for awareness.
        };

        window.addEventListener("productsUpdated", handleDataUpdated);
        window.addEventListener("purchaseBillsUpdated", handleDataUpdated);
        window.addEventListener("salesUpdated", handleDataUpdated);

        return () => {
            window.removeEventListener("productsUpdated", handleDataUpdated);
            window.removeEventListener("purchaseBillsUpdated", handleDataUpdated);
            window.removeEventListener("salesUpdated", handleDataUpdated);
        };
    }, []); // Empty dependency array as it just sets up the listeners


    // Function to calculate stock by batch for a product (using refs for latest data)
    const getStockByBatch = useCallback((productName) => {
        const batchMap = new Map();

        // Add quantities from purchase bills
        purchaseBillsRef.current.forEach(bill => {
            bill.items.forEach(item => {
                if (item.product.toLowerCase() === productName.toLowerCase()) {
                    const key = `${item.batch.trim()}_${item.expiry.trim()}`;
                    batchMap.set(key, (batchMap.get(key) || 0) + Number(item.quantity));
                }
            });
        });

        // Subtract quantities from sales bills
        salesBillsRef.current.forEach(bill => {
            bill.items.forEach(item => {
                if (item.productName.toLowerCase() === productName.toLowerCase()) {
                    const key = `${item.batch.trim()}_${item.expiry.trim()}`;
                    batchMap.set(key, Math.max(0, (batchMap.get(key) || 0) - Number(item.quantity)));
                }
            });
        });

        return Array.from(batchMap.entries()).map(([key, quantity]) => {
            const [batch, expiry] = key.split('_');
            return { batch, expiry, quantity };
        }).filter(batch => batch.quantity > 0).sort((a, b) => {
            const dateA = parseMonthYearDate(a.expiry); // Use parseMonthYearDate for expiry
            const dateB = parseMonthYearDate(b.expiry);
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateA.getTime() - dateB.getTime();
        });
    }, []); // No direct state dependencies, uses refs

    // Helper function to calculate total stock for a product, for display
    const calculateTotalStockForProduct = useCallback((productName) => {
        const batchStocks = getStockByBatch(productName);
        return batchStocks.reduce((sum, batch) => sum + batch.quantity, 0);
    }, [getStockByBatch]);

    // Filter products based on search query and update stock display
    useEffect(() => {
        if (searchQuery) {
            const filtered = products.filter(product =>
                product.name.toLowerCase().includes(searchQuery.toLowerCase())
            ).map(product => ({
                ...product,
                calculatedCurrentStock: calculateTotalStockForProduct(product.name)
            }));
            setFilteredProducts(filtered);
            setIsProductListVisible(true);
        } else {
            // When search is empty, show all products with calculated stock
            setFilteredProducts(products.map(product => ({
                ...product,
                calculatedCurrentStock: calculateTotalStockForProduct(product.name)
            })));
            setIsProductListVisible(false); // Hide if search is empty
        }
    }, [searchQuery, products, calculateTotalStockForProduct]);

    // Calculate item total whenever currentSaleItem changes
    useEffect(() => {
        const quantity = Number(currentSaleItem.quantity) || 0;
        const salePrice = Number(currentSaleItem.salePrice) || 0;
        const discount = Number(currentSaleItem.discount) || 0;
        const taxRate = Number(currentSaleItem.taxRate) || 0;

        const itemSubtotal = quantity * salePrice;
        const itemDiscountAmount = itemSubtotal * (discount / 100);
        const itemAmountAfterDiscount = itemSubtotal - itemDiscountAmount;
        const itemTaxAmount = itemAmountAfterDiscount * (taxRate / 100);
        const itemTotal = itemAmountAfterDiscount + itemTaxAmount;

        setCurrentSaleItem(prev => ({
            ...prev,
            itemSubtotal: itemSubtotal,
            itemDiscountAmount: itemDiscountAmount,
            itemTaxAmount: itemTaxAmount,
            itemTotal: itemTotal,
        }));
    }, [currentSaleItem.quantity, currentSaleItem.salePrice, currentSaleItem.discount, currentSaleItem.taxRate]);

    // Calculate grand totals whenever sales items change
    useEffect(() => {
        const newSubTotal = currentSale.items.reduce((sum, item) => sum + item.itemSubtotal, 0);
        const newTotalDiscount = currentSale.items.reduce((sum, item) => sum + item.itemDiscountAmount, 0);
        const newTotalTax = currentSale.items.reduce((sum, item) => sum + item.itemTaxAmount, 0);
        const newGrandTotal = currentSale.items.reduce((sum, item) => sum + item.itemTotal, 0);

        const paidAmount = Number(currentSale.paidAmount) || 0;
        const balanceAmount = newGrandTotal - paidAmount;

        setCurrentSale(prev => ({
            ...prev,
            subTotal: newSubTotal,
            totalDiscount: newTotalDiscount,
            totalTax: newTotalTax,
            grandTotal: newGrandTotal,
            balanceAmount: balanceAmount,
        }));
    }, [currentSale.items, currentSale.paidAmount]);

    // Handle form input changes for current sale
    const handleSaleChange = (e) => {
        const { name, value } = e.target;
        setCurrentSale(prev => ({ ...prev, [name]: value }));
    };

    // Handle input changes for current sale item
    const handleCurrentSaleItemChange = (e) => {
        const { name, value } = e.target;
        setCurrentSaleItem(prev => ({ ...prev, [name]: value }));
    };

    // Handle change for price type selection (MRP vs Sale Price)
    const handlePriceTypeChange = (e) => {
        const { value } = e.target;
        setCurrentSaleItem(prev => {
            let newSalePrice = prev.salePrice; // Default to current salePrice
            // Ensure we use the packSize that was set from itemsPerPack when the product was selected
            const productPackSize = Number(prev.packSize) || 1; 
            const mrpPerItem = (Number(prev.mrp) || 0) / productPackSize;
            const initialSalePricePerItem = (Number(prev.initialSalePrice) || 0); // initialSalePrice is already per item

            if (value === 'mrp') {
                newSalePrice = mrpPerItem;
            } else if (value === 'salePrice') {
                newSalePrice = initialSalePricePerItem;
            }
            // If value is 'custom', newSalePrice remains prev.salePrice (user can type)

            return {
                ...prev,
                selectedPriceType: value,
                salePrice: newSalePrice,
            };
        });
    };

    // When a product is selected from the search results
    const handleProductSelect = (product) => {
        // Find if a product with the same ID and batch exists in the current sale items
        const existingItemIndex = currentSale.items.findIndex(
            (item) => item.productId === product.id && item.batch === currentSaleItem.batch && item.expiry === currentSaleItem.expiry // FIX: Added expiry to uniqueness check
        );

        if (existingItemIndex !== -1) {
            toast.warning(`Product "${product.name}" with Batch "${currentSaleItem.batch}" and Expiry "${currentSaleItem.expiry}" already exists in the current sale. Edit its quantity directly.`); // FIX: Updated toast message
            setSearchQuery(''); // Clear search to hide product list
            setIsProductListVisible(false);
            return;
        }

        // Find the latest batch and expiry for the selected product from purchase bills
        let latestBatch = '';
        let latestExpiry = '';
        let latestPurchaseDate = 0; // To track the most recent purchase

        purchaseBillsRef.current.forEach(bill => {
            bill.items.forEach(item => {
                // Match by product ID or name, and ensure it's a valid purchase item
                if (item.id === product.id || item.product.toLowerCase() === product.name.toLowerCase()) {
                    const billDateTime = parseDate(bill.date)?.getTime() || 0;
                    if (billDateTime > latestPurchaseDate) {
                        latestPurchaseDate = billDateTime;
                        latestBatch = item.batch || '';
                        latestExpiry = item.expiry || '';
                    }
                }
            });
        });

        // Calculate MRP and Sale Price per individual item based on packSize (which is itemsPerPack from product master)
        const productPackSize = Number(product.itemsPerPack) || 1; // Correctly get from product.itemsPerPack
        const mrpPerItem = (Number(product.mrp) || 0) / productPackSize;
        const salePricePerItem = (Number(product.salePrice) || Number(product.mrp) || 0) / productPackSize;


        // Initialize currentSaleItem with selected product details
        setCurrentSaleItem({
            productId: product.id,
            productName: product.name,
            unit: product.unit,
            category: product.category,
            batch: latestBatch, // Auto-filled batch
            expiry: latestExpiry, // Auto-filled expiry
            quantity: 1, // Default to 1
            mrp: mrpPerItem, // Store MRP per item
            salePrice: salePricePerItem, // Prefer salePrice per item, fallback to MRP per item
            initialSalePrice: salePricePerItem, // Store initial sale price per item for toggling
            discount: Number(product.discount) || 0,
            taxRate: Number(product.taxRate) || 0,
            itemSubtotal: 0, // Will be calculated by useEffect
            itemDiscountAmount: 0, // Will be calculated by useEffect
            itemTaxAmount: 0, // Will be calculated by useEffect
            itemTotal: 0, // Will be calculated by useEffect
            hsn: product.hsn || '',
            schedule: product.schedule || '',
            barcode: product.barcode || '',
            selectedPriceType: 'salePrice', // Default to salePrice on selection
            packSize: productPackSize, // Store packSize (which is itemsPerPack) for reference in currentSaleItem
        });
        setSearchQuery(product.name); // Keep selected product name in search bar
        setIsProductListVisible(false); // Hide the product list
    };

    // Add item to current sale
    const handleAddItemToSale = () => {
        const { productName, quantity, batch, expiry, salePrice } = currentSaleItem;

        if (!productName || !quantity || Number(quantity) <= 0) {
            toast.error('Please select a product and enter a valid quantity.');
            return;
        }
        // Removed batch and expiry validation checks, they are now optional
        if (Number(salePrice) <= 0) {
            toast.error('Sale Price must be greater than 0.');
            return;
        }

        // Check against dynamically calculated stock
        const currentProductStock = calculateTotalStockForProduct(productName);
        const quantityAlreadyInCurrentSale = currentSale.items.reduce((sum, item) => {
            return item.productId === currentSaleItem.productId && item.batch === currentSaleItem.batch
                ? sum + Number(item.quantity)
                : sum;
        }, 0);

        const effectiveAvailableStock = currentProductStock - quantityAlreadyInCurrentSale;

        if (Number(quantity) > effectiveAvailableStock) {
            toast.error(`Not enough stock for "${productName}" (Batch: ${batch}). Available: ${effectiveAvailableStock || 0} items.`);
            return;
        }

        const newItem = { ...currentSaleItem, quantity: Number(quantity) };
        setCurrentSale(prev => ({
            ...prev,
            items: [...prev.items, newItem],
        }));

        // Clear current sale item form
        setCurrentSaleItem({
            productId: '', productName: '', unit: '', category: '', batch: '', expiry: '', quantity: '', mrp: '',
            salePrice: '', discount: '', taxRate: '', itemSubtotal: 0, itemDiscountAmount: 0, itemTaxAmount: 0, itemTotal: 0,
            hsn: '', schedule: '', barcode: '', selectedPriceType: 'salePrice', packSize: 1,
        });
        setSearchQuery('');
        toast.success(`"${productName}" added to sale.`);
    };

    // Handle editing an item already added to the current sale
    const handleEditCurrentSaleItem = (index, field, value) => {
        setCurrentSale(prevSale => {
            const updatedItems = [...prevSale.items];
            const itemToUpdate = { ...updatedItems[index] };

            // Store original values for potential revert
            const originalBatch = itemToUpdate.batch;
            const originalExpiry = itemToUpdate.expiry;
            const originalProductId = itemToUpdate.productId;

            // Apply the change
            itemToUpdate[field] = value;

            // --- Key Uniqueness Check after potential change ---
            const newKeyAttempt = `${itemToUpdate.productId}-${itemToUpdate.batch || 'no-batch'}-${itemToUpdate.expiry || 'no-expiry'}`;
            const isDuplicateKey = updatedItems.some((item, i) => {
                if (i === index) return false; // Don't compare with itself
                const existingKey = `${item.productId}-${item.batch || 'no-batch'}-${item.expiry || 'no-expiry'}`;
                return existingKey === newKeyAttempt;
            });

            if (isDuplicateKey) {
                toast.error(`Combination of Product, Batch, and Expiry must be unique within the sale. Reverting "${field}" change.`);
                // Revert the specific field that caused the duplicate
                if (field === 'batch') itemToUpdate.batch = originalBatch;
                if (field === 'expiry') itemToUpdate.expiry = originalExpiry;
                // Note: productId should not typically be edited in this inline table
                // If it were, similar revert logic would apply.
                // We're reverting the field directly on itemToUpdate, then continuing
                // so the rest of the calculations are still applied to the reverted value.
            }
            // --- End Key Uniqueness Check ---


            // Recalculate item totals based on updated (or potentially reverted) values
            const quantity = Number(itemToUpdate.quantity) || 0;
            const salePrice = Number(itemToUpdate.salePrice) || 0;
            const discount = Number(itemToUpdate.discount) || 0;
            const taxRate = Number(itemToUpdate.taxRate) || 0;

            const itemSubtotal = quantity * salePrice;
            const itemDiscountAmount = itemSubtotal * (discount / 100);
            const itemAmountAfterDiscount = itemSubtotal - itemDiscountAmount;
            const itemTaxAmount = itemAmountAfterDiscount * (taxRate / 100);
            const itemTotal = itemAmountAfterDiscount + itemTaxAmount;

            itemToUpdate.itemSubtotal = itemSubtotal;
            itemToUpdate.itemDiscountAmount = itemDiscountAmount;
            itemToUpdate.itemTaxAmount = itemTaxAmount;
            itemToUpdate.itemTotal = itemTotal;

            // --- Stock Check on Edit ---
            const currentProductStock = calculateTotalStockForProduct(itemToUpdate.productName);
            // Sum of quantities for this product (and batch) from other items in the current sale (excluding the one being edited)
            const otherItemsQuantityInCurrentSale = updatedItems.reduce((sum, item, i) => {
                // FIX: Ensure comparison also includes expiry for accurate stock check when editing
                return i !== index && item.productId === itemToUpdate.productId && item.batch === itemToUpdate.batch && item.expiry === itemToUpdate.expiry
                    ? sum + Number(item.quantity)
                    : sum;
            }, 0);

            const effectiveAvailableStock = currentProductStock - otherItemsQuantityInCurrentSale;

            if (Number(itemToUpdate.quantity) > effectiveAvailableStock) {
                toast.error(`Not enough stock for "${itemToUpdate.productName}" (Batch: ${itemToUpdate.batch}). Available: ${effectiveAvailableStock || 0} items. Cannot set quantity to ${itemToUpdate.quantity}.`);
                // Revert the quantity to the maximum available if the user tries to exceed stock
                itemToUpdate.quantity = effectiveAvailableStock;
                // Recalculate totals for the reverted quantity
                const revertedQuantity = effectiveAvailableStock;
                const revertedItemSubtotal = revertedQuantity * salePrice;
                const revertedItemDiscountAmount = revertedItemSubtotal * (discount / 100);
                const revertedItemAmountAfterDiscount = revertedItemSubtotal - revertedItemDiscountAmount;
                const revertedItemTaxAmount = revertedItemAmountAfterDiscount * (taxRate / 100);
                const revertedItemTotal = revertedItemAmountAfterDiscount + revertedItemTaxAmount;

                itemToUpdate.itemSubtotal = revertedItemSubtotal;
                itemToUpdate.itemDiscountAmount = revertedItemDiscountAmount;
                itemToUpdate.itemTaxAmount = revertedItemTaxAmount;
                itemToUpdate.itemTotal = revertedItemTotal;
            }
            // --- End Stock Check on Edit ---

            updatedItems[index] = itemToUpdate;
            return { ...prevSale, items: updatedItems };
        });
        toast.success(`Item updated.`); // Moved outside to avoid multiple toasts on single change
    };


    // Remove item from current sale
    const handleRemoveItem = (index) => {
        const updatedItems = currentSale.items.filter((_, i) => i !== index);
        setCurrentSale(prev => ({ ...prev, items: updatedItems }));
        toast.info('Item removed from sale.');
    };

    // Save or Update a Sale (Firestore integration)
    const handleSaveSale = async () => {
        if (!userId) {
            toast.error("User not authenticated. Cannot save sale.");
            return;
        }

        if (!currentSale.customerName.trim()) {
            toast.error('Customer Name is required.');
            return;
        }
        if (!currentSale.saleDate) {
            toast.error('Sale Date is required.');
            return;
        }
        if (currentSale.items.length === 0) {
            toast.error('Please add at least one item to the sale.');
            return;
        }

        // Final stock check before saving (critical)
        const productQuantitiesInCurrentSale = new Map();
        currentSale.items.forEach(item => {
            const key = `${item.productId}_${item.batch}`;
            productQuantitiesInCurrentSale.set(key, (productQuantitiesInCurrentSale.get(key) || 0) + Number(item.quantity));
        });

        for (const [key, quantityInSale] of productQuantitiesInCurrentSale.entries()) {
            const [productId, batch] = key.split('_');
            const productInMaster = products.find(p => p.id === productId);

            if (productInMaster) {
                const currentStockForProductBatch = getStockByBatch(productInMaster.name).find(b => b.batch === batch)?.quantity || 0;

                let quantityFromPreviousSale = 0;
                if (editingSaleId) {
                    const previousSale = sales.find(s => s.id === editingSaleId);
                    if (previousSale) {
                        quantityFromPreviousSale = previousSale.items.reduce((sum, prevItem) => {
                            return prevItem.productId === productId && prevItem.batch === batch
                                ? sum + Number(prevItem.quantity)
                                : sum;
                        }, 0);
                    }
                }

                // Calculate the net change this sale will cause to the stock
                const netChange = quantityInSale - quantityFromPreviousSale;

                if (currentStockForProductBatch < netChange) {
                    toast.error(`Insufficient stock for "${productInMaster.name}" (Batch: ${batch}). Available: ${currentStockForProductBatch}. Attempting to sell: ${quantityInSale} (net change: ${netChange}).`);
                    return; // Prevent saving if stock is insufficient
                }
            } else {
                toast.warning(`Product with ID ${productId} not found in master data. Stock check skipped for this item.`);
            }
        }

        const saleToSave = {
            ...currentSale,
            // Ensure numbers are stored as numbers, not strings from input
            subTotal: Number(currentSale.subTotal),
            totalDiscount: Number(currentSale.totalDiscount),
            totalTax: Number(currentSale.totalTax),
            grandTotal: Number(currentSale.grandTotal),
            paidAmount: Number(currentSale.paidAmount),
            balanceAmount: Number(currentSale.balanceAmount),
            items: currentSale.items.map(item => ({
                ...item,
                quantity: Number(item.quantity),
                mrp: Number(item.mrp),
                salePrice: Number(item.salePrice),
                discount: Number(item.discount),
                taxRate: Number(item.taxRate),
                itemSubtotal: Number(item.itemSubtotal),
                itemDiscountAmount: Number(item.itemDiscountAmount),
                itemTaxAmount: Number(item.itemTaxAmount),
                itemTotal: Number(item.itemTotal),
                // Ensure packSize is saved with the item
                packSize: Number(item.packSize) || 1,
            })),
        };

        try {
            const salesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/sales`);
            if (editingSaleId) {
                // Update existing document
                await updateDoc(doc(salesCollectionRef, editingSaleId), saleToSave);
                toast.success(`Sale to ${saleToSave.customerName} updated successfully!`);
            } else {
                // Add new document
                await addDoc(salesCollectionRef, saleToSave);
                toast.success(`Sale to ${saleToSave.customerName} saved successfully!`);
            }
            // Dispatch event to notify other components (including this one to re-calculate stock)
            window.dispatchEvent(new Event('salesUpdated'));
            window.dispatchEvent(new Event('productsUpdated')); // Also notify products page if it relies on sales

            handleClearSale(); // Clear form after saving
        } catch (e) {
            console.error("Error saving sale to Firestore: ", e);
            toast.error("Failed to save sale to Firestore.");
        }
    };

    // Edit a Sale
    const handleEditSale = (sale) => {
        setEditingSaleId(sale.id);
        setCurrentSale({
            ...sale,
            paidAmount: sale.paidAmount.toString(), // Convert to string for input field
        });
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top of the form
    };

    // Delete a Sale (Firestore integration)
    const handleDeleteSale = async (id) => {
        if (!userId) {
            toast.error("User not authenticated. Cannot delete sale.");
            return;
        }
        // Using a custom modal for confirmation instead of window.confirm
        // For this example, I'll use a toast that implies confirmation,
        // but in a real app, you'd show a custom dialog.
        toast.info("Deleting sale...", { duration: 1000 }); // Provide feedback

        try {
            const salesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/sales`);
            await deleteDoc(doc(salesCollectionRef, id));
            toast.success('Sale deleted successfully.');
            // Dispatch event to notify other components (including this one to re-calculate stock)
            window.dispatchEvent(new Event('salesUpdated'));
            window.dispatchEvent(new Event('productsUpdated')); // Also notify products page if it relies on sales
        } catch (e) {
            console.error("Error deleting sale from Firestore: ", e);
            toast.error("Failed to delete sale from Firestore.");
        }
    };

    // Clear the current sale form
    const handleClearSale = () => {
        setEditingSaleId(null);
        setCurrentSale({
            id: null,
            customerName: '',
            saleDate: formatDate(new Date()),
            items: [],
            subTotal: 0,
            totalDiscount: 0,
            totalTax: 0,
            grandTotal: 0,
            paidAmount: '',
            balanceAmount: 0,
            paymentMethod: 'Cash',
            notes: '',
        });
        setCurrentSaleItem({
            productId: '', productName: '', unit: '', category: '', batch: '', expiry: '', quantity: '', mrp: '',
            salePrice: '', discount: '', taxRate: '', itemSubtotal: 0, itemDiscountAmount: 0, itemTaxAmount: 0, itemTotal: 0,
            hsn: '', schedule: '', barcode: '', selectedPriceType: 'salePrice', packSize: 1,
        });
        setSearchQuery('');
        setIsProductListVisible(false);
        toast.info('Sale form cleared.');
    };

    // Toggle sales row expansion
    const toggleExpansion = (id) => {
        setExpandedSaleId(expandedSaleId === id ? null : id);
    };

    // View Sale in Modal
    const handleViewSale = (sale) => {
        setViewingSale(sale);
        setIsViewModalOpen(true);
    };

    const handleCloseViewModal = () => {
        setIsViewModalOpen(false);
        setViewingSale(null);
    };

    // Memoized filtered and sorted sales for display
    const filteredAndSortedSales = useMemo(() => {
        let filtered = sales.filter(sale =>
            sale.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sale.items.some(item => item.productName.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        if (sortColumn) {
            filtered.sort((a, b) => {
                let aValue = a[sortColumn];
                let bValue = b[sortColumn];

                if (sortColumn === 'saleDate') {
                    aValue = parseDate(aValue)?.getTime() || 0;
                    bValue = parseDate(bValue)?.getTime() || 0;
                } else if (typeof aValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }

                if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [sales, searchQuery, sortColumn, sortDirection]);

    // Pagination logic
    const indexOfLastSale = currentPage * salesPerPage;
    const indexOfFirstSale = indexOfLastSale - salesPerPage;
    const currentFilteredAndSortedSales = useMemo(() => {
        return filteredAndSortedSales.slice(indexOfFirstSale, indexOfLastSale);
    }, [filteredAndSortedSales, indexOfFirstSale, indexOfLastSale]);

    const totalPages = Math.ceil(filteredAndSortedSales.length / salesPerPage);

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
                    <h2 className="text-3xl font-bold text-gray-800">Sales</h2>
                    <Button onClick={() => router.push('/')} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200" >
                        Go to Dashboard
                    </Button>
                </div>

                {/* Display User ID (MANDATORY for multi-user apps) */}
                {userId && (
                    <div className="mb-4 p-3 bg-gray-200 rounded-md text-sm text-gray-700">
                        <span className="font-semibold">Current User ID:</span> {userId}
                    </div>
                )}

                {/* Sales Form */}
                <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
                    <h3 className="text-2xl font-semibold text-gray-700 mb-4 border-b pb-3 border-gray-200">
                        {editingSaleId ? 'Edit Sale' : 'New Sale'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                            <input type="text" id="customerName" name="customerName" value={currentSale.customerName} onChange={handleSaleChange} placeholder="Enter customer name" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="saleDate" className="block text-sm font-medium text-gray-700 mb-1">Sale Date</label>
                            <input type="text" id="saleDate" name="saleDate" value={currentSale.saleDate} onChange={handleSaleChange} placeholder="DD-MM-YYYY" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                    </div>

                    {/* Add Item Section */}
                    <h4 className="text-xl font-semibold text-gray-700 mb-3 border-b pb-2 border-gray-200">Add Item to Sale</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="relative">
                            <label htmlFor="productName" className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                            <input
                                type="text"
                                id="productName"
                                name="productName"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentSaleItem(prev => ({ ...prev, productName: e.target.value }));
                                    setIsProductListVisible(true);
                                }}
                                onFocus={() => setIsProductListVisible(true)}
                                onBlur={() => setTimeout(() => setIsProductListVisible(false), 200)}
                                placeholder="Search & Select Product"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                ref={productSearchRef}
                            />
                            {isProductListVisible && searchQuery && filteredProducts.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                                    {filteredProducts.map(product => {
                                        // Display calculated current stock
                                        const displayStock = product.calculatedCurrentStock;
                                        return (
                                            <li
                                                key={product.id}
                                                onMouseDown={() => handleProductSelect(product)} // Use onMouseDown to trigger before onBlur
                                                className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-gray-800 text-sm"
                                            >
                                                {product.name} ({product.unit}) - Stock: {displayStock}
                                                {displayStock <= 0 && <AlertTriangle className="inline-block h-4 w-4 ml-2 text-red-500" title="Out of Stock" />}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                            {isProductListVisible && searchQuery && filteredProducts.length === 0 && (
                                <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1 px-3 py-2 text-sm text-gray-500">
                                    No products found.
                                </div>
                            )}
                        </div>
                        <div>
                            <label htmlFor="batch" className="block text-sm font-medium text-gray-700 mb-1">Batch No.</label>
                            <input type="text" id="batch" name="batch" value={currentSaleItem.batch} onChange={handleCurrentSaleItemChange} placeholder="e.g., B12345" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="expiry" className="block text-sm font-medium text-gray-700 mb-1">Expiry (MM-YYYY)</label>
                            <input type="text" id="expiry" name="expiry" value={currentSaleItem.expiry} onChange={handleCurrentSaleItemChange} placeholder="e.g., 12-2025" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">Quantity (Individual Items)</label>
                            <input type="number" id="quantity" name="quantity" value={currentSaleItem.quantity} onChange={handleCurrentSaleItemChange} placeholder="e.g., 1" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" min="1" />
                        </div>

                        {/* Price Type Selection and Sale Price input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price Type</label>
                            <div className="flex items-center mt-1">
                                <label htmlFor="priceTypeMRP" className="mr-4 flex items-center">
                                    <input
                                        type="radio"
                                        id="priceTypeMRP"
                                        name="selectedPriceType"
                                        value="mrp"
                                        checked={currentSaleItem.selectedPriceType === 'mrp'}
                                        onChange={handlePriceTypeChange}
                                        className="form-radio h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">MRP ({(Number(currentSaleItem.mrp) || 0).toFixed(2)})</span>
                                </label>
                                <label htmlFor="priceTypeSalePrice" className="mr-4 flex items-center">
                                    <input
                                        type="radio"
                                        id="priceTypeSalePrice"
                                        name="selectedPriceType"
                                        value="salePrice"
                                        checked={currentSaleItem.selectedPriceType === 'salePrice'}
                                        onChange={handlePriceTypeChange}
                                        className="form-radio h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Sale Price ({(Number(currentSaleItem.initialSalePrice) || 0).toFixed(2)})</span>
                                </label>
                                <label htmlFor="priceTypeCustom" className="flex items-center">
                                    <input
                                        type="radio"
                                        id="priceTypeCustom"
                                        name="selectedPriceType"
                                        value="custom"
                                        checked={currentSaleItem.selectedPriceType === 'custom'}
                                        onChange={handlePriceTypeChange}
                                        className="form-radio h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Custom Price</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="salePrice" className="block text-sm font-medium text-gray-700 mb-1">Sale Price / Item</label>
                            <input
                                type="number"
                                id="salePrice"
                                name="salePrice"
                                value={currentSaleItem.salePrice}
                                onChange={handleCurrentSaleItemChange}
                                placeholder="e.g., 89.99"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                step="0.01"
                                min="0"
                                readOnly={currentSaleItem.selectedPriceType !== 'custom'} // Make read-only if not custom
                            />
                        </div>

                        <div>
                            <label htmlFor="discount" className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                            <input type="number" id="discount" name="discount" value={currentSaleItem.discount} onChange={handleCurrentSaleItemChange} placeholder="e.g., 10" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" step="0.01" min="0" max="100" />
                        </div>
                        <div>
                            <label htmlFor="taxRate" className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                            <input type="number" id="taxRate" name="taxRate" value={currentSaleItem.taxRate} onChange={handleCurrentSaleItemChange} placeholder="e.g., 18" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" step="0.01" min="0" max="100" />
                        </div>
                        <div className="col-span-full md:col-span-1 lg:col-span-1">
                            <label htmlFor="itemTotal" className="block text-sm font-medium text-gray-700 mb-1">Item Total</label>
                            <input type="text" id="itemTotal" name="itemTotal" value={`₹${(Number(currentSaleItem.itemTotal) || 0).toFixed(2)}`} readOnly className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 text-gray-900 sm:text-sm" />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleAddItemToSale} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200" >
                            <Plus className="mr-2 h-4 w-4" /> Add Item
                        </Button>
                    </div>

                    {/* Sale Items Table */}
                    {currentSale.items.length > 0 && (
                        <div className="mt-6">
                            <h4 className="text-xl font-semibold text-gray-700 mb-3">Items in Current Sale</h4>
                            <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MRP</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Price</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount (%)</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax (%)</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Total</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {currentSale.items.map((item, index) => (
                                            <tr key={`${item.productId}-${item.batch || 'no-batch'}-${item.expiry || 'no-expiry'}`} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.productName}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    <input type="text" value={item.batch} onChange={(e) => handleEditCurrentSaleItem(index, 'batch', e.target.value)} className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm" />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    <input type="text" value={item.expiry} onChange={(e) => handleEditCurrentSaleItem(index, 'expiry', e.target.value)} className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm" placeholder="MM-YYYY" />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    <input type="number" value={item.quantity} onChange={(e) => handleEditCurrentSaleItem(index, 'quantity', e.target.value)} className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm" min="1" />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    <input type="number" value={(Number(item.mrp) || 0).toFixed(2)} onChange={(e) => handleEditCurrentSaleItem(index, 'mrp', e.target.value)} className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm" step="0.01" min="0" />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    <input type="number" value={(Number(item.salePrice) || 0).toFixed(2)} onChange={(e) => handleEditCurrentSaleItem(index, 'salePrice', e.target.value)} className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm" step="0.01" min="0" />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    <input type="number" value={item.discount} onChange={(e) => handleEditCurrentSaleItem(index, 'discount', e.target.value)} className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm" step="0.01" min="0" max="100" />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    <input type="number" value={item.taxRate} onChange={(e) => handleEditCurrentSaleItem(index, 'taxRate', e.target.value)} className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm" step="0.01" min="0" max="100" />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{(Number(item.itemTotal) || 0).toFixed(2)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <Button onClick={() => handleRemoveItem(index)} className="text-red-600 hover:text-red-900 bg-transparent hover:bg-red-50 p-1 rounded-md transition-colors duration-200">
                                                        <X className="h-5 w-5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Totals Section */}
                    <div className="mt-6 border-t pt-4 border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <div>
                                <label htmlFor="subTotal" className="block text-sm font-medium text-gray-700 mb-1">Sub Total</label>
                                <input type="text" id="subTotal" value={`₹${(Number(currentSale.subTotal) || 0).toFixed(2)}`} readOnly className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 text-gray-900 sm:text-sm" />
                            </div>
                            <div>
                                <label htmlFor="totalDiscount" className="block text-sm font-medium text-gray-700 mb-1">Total Discount</label>
                                <input type="text" id="totalDiscount" value={`₹${(Number(currentSale.totalDiscount) || 0).toFixed(2)}`} readOnly className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 text-gray-900 sm:text-sm" />
                            </div>
                            <div>
                                <label htmlFor="totalTax" className="block text-sm font-medium text-gray-700 mb-1">Total Tax</label>
                                <input type="text" id="totalTax" value={`₹${(Number(currentSale.totalTax) || 0).toFixed(2)}`} readOnly className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 text-gray-900 sm:text-sm" />
                            </div>
                            <div>
                                <label htmlFor="grandTotal" className="block text-sm font-medium text-gray-700 mb-1">Grand Total</label>
                                <input type="text" id="grandTotal" value={`₹${(Number(currentSale.grandTotal) || 0).toFixed(2)}`} readOnly className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-indigo-50 text-indigo-900 font-bold sm:text-sm" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                                <label htmlFor="paidAmount" className="block text-sm font-medium text-gray-700 mb-1">Paid Amount</label>
                                <input type="number" id="paidAmount" name="paidAmount" value={currentSale.paidAmount} onChange={handleSaleChange} placeholder="e.g., 500.00" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" step="0.01" min="0" />
                            </div>
                            <div>
                                <label htmlFor="balanceAmount" className="block text-sm font-medium text-gray-700 mb-1">Balance Amount</label>
                                <input type="text" id="balanceAmount" value={`₹${(Number(currentSale.balanceAmount) || 0).toFixed(2)}`} readOnly className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 text-gray-900 sm:text-sm" />
                            </div>
                            <div>
                                <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                                <select id="paymentMethod" name="paymentMethod" value={currentSale.paymentMethod} onChange={handleSaleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                    <option value="Cash">Cash</option>
                                    <option value="Credit Card">Credit Card</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                <textarea id="notes" name="notes" value={currentSale.notes} onChange={handleSaleChange} rows="1" placeholder="Add any notes here" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3">
                            <Button onClick={handleClearSale} className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200">
                                <RefreshCcw className="mr-2 h-4 w-4" /> Clear
                            </Button>
                            <Button onClick={handleSaveSale} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200">
                                <Save className="mr-2 h-4 w-4" /> {editingSaleId ? 'Update Sale' : 'Save Sale'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Sales List */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h3 className="text-2xl font-semibold text-gray-700 mb-4 border-b pb-3 border-gray-200">Existing Sales</h3>
                    <div className="mb-4 flex justify-between items-center">
                        <input
                            type="text"
                            placeholder="Search sales by customer or product name..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1); // Reset to first page on search
                            }}
                            className="max-w-xs block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                        <Search className="h-5 w-5 text-gray-400 -ml-8" />
                    </div>

                    <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('customerName')}>
                                        Customer Name
                                        {sortColumn === 'customerName' && (sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />)}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('saleDate')}>
                                        Sale Date
                                        {sortColumn === 'saleDate' && (sortDirection === 'asc' ? <ArrowDownUp className="inline ml-1 h-3 w-3" /> : <ArrowDownUp className="inline ml-1 h-3 w-3 rotate-180" />)}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Items</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grand Total</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {currentFilteredAndSortedSales.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                                            No sales found.
                                        </td>
                                    </tr>
                                ) : (
                                    currentFilteredAndSortedSales.map((sale) => (
                                        <React.Fragment key={sale.id}>
                                            <tr className="hover:bg-indigo-50 transition-colors duration-150 ease-in-out cursor-pointer" onClick={() => toggleExpansion(sale.id)}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sale.customerName}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sale.saleDate}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sale.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{(Number(sale.grandTotal) || 0).toFixed(2)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{(Number(sale.paidAmount) || 0).toFixed(2)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{(Number(sale.balanceAmount) || 0).toFixed(2)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex justify-end space-x-2">
                                                        <Button onClick={(e) => { e.stopPropagation(); if (sale.id) handleViewSale(sale); else toast.error('Sale ID is missing for this entry.'); }} className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 p-1 rounded-md transition-colors duration-200">
                                                            <Eye className="h-5 w-5" />
                                                        </Button>
                                                        <Button onClick={(e) => { e.stopPropagation(); if (sale.id) handleEditSale(sale); else toast.error('Sale ID is missing for this entry.'); }} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-1 rounded-md transition-colors duration-200">
                                                            <Edit className="h-5 w-5" />
                                                        </Button>
                                                        <Button onClick={(e) => { e.stopPropagation(); if (sale.id) handleDeleteSale(sale.id); else toast.error('Sale ID is missing for this entry.'); }} className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-1 rounded-md transition-colors duration-200">
                                                            <Trash2 className="h-5 w-5" />
                                                        </Button>
                                                        <Button onClick={(e) => { e.stopPropagation(); toggleExpansion(sale.id); }} className="text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 p-1 rounded-md transition-colors duration-200">
                                                            {expandedSaleId === sale.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedSaleId === sale.id && (
                                                <tr className="bg-indigo-50">
                                                    <td colSpan="8" className="px-6 py-4">
                                                        <div className="expandable-content transition-all duration-300 ease-out max-h-500 overflow-hidden">
                                                            <h5 className="text-lg font-semibold text-indigo-800 mb-2">Sale Details for {sale.customerName}</h5>
                                                            <ul className="list-disc list-inside text-sm text-indigo-700">
                                                                {sale.items.map((item) => ( // Removed itemIndex from here, as it's not needed for the key
                                                                    <li key={`${item.productId}-${item.batch || 'no-batch'}-${item.expiry || 'no-expiry'}`} className="mb-1">
                                                                        {item.productName} (Qty: {item.quantity}, Price: ₹{(Number(item.salePrice) || 0).toFixed(2)}, Disc: {(Number(item.discount) || 0).toFixed(2)}%, Tax: {(Number(item.taxRate) || 0).toFixed(2)}%, Total: ₹{(Number(item.itemTotal) || 0).toFixed(2)})
                                                                        {item.batch && ` - Batch: ${item.batch}`}
                                                                        {item.expiry && ` (Expiry: ${item.expiry})`}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                            {sale.notes && (
                                                                <p className="text-sm text-indigo-700 mt-2"><strong>Notes:</strong> {sale.notes}</p>
                                                            )}
                                                            <p className="text-sm text-indigo-700 mt-2"><strong>Payment Method:</strong> {sale.paymentMethod || 'N/A'}</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <nav className="mt-4 flex justify-center" aria-label="Pagination">
                            <ul className="flex items-center -space-x-px h-10 text-base">
                                <li>
                                    <Button
                                        onClick={() => paginate(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="flex items-center justify-center px-4 h-10 ml-0 leading-tight text-gray-500 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="h-4 w-4" /> Previous
                                    </Button>
                                </li>
                                {[...Array(totalPages)].map((_, index) => (
                                    <li key={index}>
                                        <Button
                                            onClick={() => paginate(index + 1)}
                                            className={`flex items-center justify-center px-4 h-10 leading-tight border border-gray-300 hover:bg-gray-100 hover:text-gray-700 ${currentPage === index + 1 ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-gray-500 bg-white'}`}
                                        >
                                            {index + 1}
                                        </Button>
                                    </li>
                                ))}
                                <li>
                                    <Button
                                        onClick={() => paginate(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="flex items-center justify-center px-4 h-10 leading-tight text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </li>
                            </ul>
                        </nav>
                    )}
                </div>
            </div>

            {/* View Sale Modal */}
            {isViewModalOpen && viewingSale && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
                    <div className="relative p-8 bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4" ref={viewModalRef}>
                        <h3 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Sale Details</h3>
                        <div className="mb-4">
                            <p className="text-lg font-semibold text-gray-700">Customer: <span className="font-normal">{viewingSale.customerName || 'N/A'}</span></p>
                            <p className="text-lg font-semibold text-gray-700">Date: <span className="font-normal">{viewingSale.saleDate || 'N/A'}</span></p>
                        </div>
                        <div className="mb-6">
                            <h4 className="text-xl font-semibold text-gray-700 mb-2">Items Sold:</h4>
                            <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MRP</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Price</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disc (%)</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax (%)</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {viewingSale.items.map((item) => (
                                            <tr key={`${item.productId}-${item.batch || 'no-batch'}-${item.expiry || 'no-expiry'}`}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.productName}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.batch}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.expiry}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{(Number(item.mrp) || 0).toFixed(2)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{(Number(item.salePrice) || 0).toFixed(2)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(Number(item.discount) || 0).toFixed(2)}%</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(Number(item.taxRate) || 0).toFixed(2)}%</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{(Number(item.itemTotal) || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 mb-6">
                            <p><span className="font-semibold">Sub Total:</span> ₹{(Number(viewingSale.subTotal) || 0).toFixed(2)}</p>
                            <p><span className="font-semibold">Total Discount:</span> ₹{(Number(viewingSale.totalDiscount) || 0).toFixed(2)}</p>
                            <p><span className="font-semibold">Total Tax:</span> ₹{(Number(viewingSale.totalTax) || 0).toFixed(2)}</p>
                            <p className="text-lg font-bold">Grand Total: ₹{(Number(viewingSale.grandTotal) || 0).toFixed(2)}</p>
                            <p><span className="font-semibold">Paid Amount:</span> ₹{(Number(viewingSale.paidAmount) || 0).toFixed(2)}</p>
                            <p><span className="font-semibold">Balance Amount:</span> ₹{(Number(viewingSale.balanceAmount) || 0).toFixed(2)}</p>
                            <p><span className="font-semibold">Payment Method:</span> {viewingSale.paymentMethod || 'N/A'}</p>
                            {viewingSale.notes && <p className="col-span-2"><span className="font-semibold">Notes:</span> {viewingSale.notes}</p>}
                        </div>

                        <div className="flex justify-end space-x-3">
                            <Button onClick={handleCloseViewModal} className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200">
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            <style jsx>{`
                .loader {
                    border: 4px solid #f3f3f3; /* Light grey */
                    border-top: 44px solid #3498db; /* Blue */
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                /* Fade-in animation for the main content */
                .fade-in {
                    animation: fadeIn 0.5s ease-out forwards;
                    opacity: 0; /* Start invisible */
                }

                @keyframes fadeIn {
                    0% { opacity: 0; transform: translateY(20px); } /* Optional: slight slide up */
                    100% { opacity: 1; transform: translateY(0); }
                }

                /* Slide animation for expandable row content */
                .expandable-content {
                    overflow: hidden; /* Hide content when collapsed */
                    transition: max-height 0.3s ease-out; /* Smooth transition */
                    max-height: 0; /* Start collapsed */
                }

                /* This class is applied by React when the row is expanded */
                tr.bg-indigo-50 + tr .expandable-content {
                    max-height: 500px; /* A large enough value to accommodate the content */
                }
            `}</style>
        </>
    );
}

export default SalesPage;
