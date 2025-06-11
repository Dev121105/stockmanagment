// app/purchase/page.js
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '../components/button';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import { toast } from 'sonner';
import { Plus, Trash2, Eye, Edit, Save, Search, RefreshCcw, Printer, Share2, X, ArrowDownUp, ChevronLeft, ChevronRight, User, Phone, Mail, MapPin, Landmark } from 'lucide-react'; // Ensure all needed icons are imported
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Import Firebase services
import { db, auth, initializeFirebaseAndAuth } from '../lib/firebase'; // Adjust path as needed
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

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
// Enhanced to handle both DD-MM-YYYY and MM-YY formats
function parseDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
        return null;
    }

    // Handle DD-MM-YYYY format
    if (dateString.includes('-') && dateString.split('-').length === 3) {
        const [day, month, year] = dateString.split('-');
        const dayInt = parseInt(day, 10);
        const monthInt = parseInt(month, 10);
        const yearInt = parseInt(year, 10);
        if (
            !isNaN(dayInt) && dayInt >= 1 && dayInt <= 31 &&
            !isNaN(monthInt) && monthInt >= 1 && monthInt <= 12 &&
            !isNaN(yearInt) && yearInt >= 1900 && yearInt <= 2100
        ) {
            return new Date(yearInt, monthInt - 1, dayInt);
        }
    }

    // Handle MM-YY format (common for expiry dates)
    if (dateString.includes('-') && dateString.split('-').length === 2) {
        const [month, year] = dateString.split('-');
        const monthInt = parseInt(month, 10);
        const currentYear = new Date().getFullYear();
        let yearInt = parseInt(year, 10);

        // Adjust 2-digit year to 4-digit based on current century
        // If year is, e.g., 90-99, assume 1900s. If 00-89, assume 2000s.
        // This is a common heuristic, adjust 50 for the cutoff year for example.
        if (yearInt < 100) {
            yearInt = (yearInt > (currentYear % 100) + 20) ? 1900 + yearInt : 2000 + yearInt;
        }

        if (
            !isNaN(monthInt) && monthInt >= 1 && monthInt <= 12 &&
            !isNaN(yearInt) && yearInt >= 1900 && yearInt <= 2100
        ) {
            // Day 0 of next month is the last day of the current month
            return new Date(yearInt, monthInt, 0); 
        }
    }

    return null; // Default to null if parsing fails
}


const PurchasePage = () => {
    const router = useRouter();
    const [purchaseBills, setPurchaseBills] = useState([]);
    const [products, setProducts] = useState([]); // Master products list
    const [salesBills, setSalesBills] = useState([]); // For stock calculation
    const [suppliers, setSuppliers] = useState([]); // All suppliers from master
    const [supplierSuggestions, setSupplierSuggestions] = useState([]); // Filtered suggestions for supplier name
    const [isSupplierListVisible, setIsSupplierListVisible] = useState(false); // Visibility of supplier suggestions

    const [billNumber, setBillNumber] = useState('');
    const [billDate, setBillDate] = useState(formatDate(new Date())); // Default to current date
    const [supplierName, setSupplierName] = useState('');
    const [currentPurchaseItems, setCurrentPurchaseItems] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);

    const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [newBatch, setNewBatch] = useState('');
    const [newExpiry, setNewExpiry] = useState('');
    const [newQuantity, setNewQuantity] = useState('');
    const [newPTR, setNewPTR] = useState('');
    const [newMRP, setNewMRP] = useState(''); // New MRP for the purchased item
    const [newDiscount, setNewDiscount] = useState(''); // Discount on purchase line item

    const [viewBillModalOpen, setViewBillModalOpen] = useState(false);
    const [selectedBillForView, setSelectedBillForView] = useState(null);

    const [isEditingBill, setIsEditingBill] = useState(false);
    const [editBillId, setEditBillId] = useState(null);

    // Firebase specific states
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [loading, setLoading] = useState(true); // Combined loading state
    const [error, setError] = useState(null); // Error state

    // Get the app ID, with a fallback for environments where it might not be defined
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';


    const productsRef = useRef(products); // Ref to current products state for stock calculation
    const purchaseBillsRef = useRef(purchaseBills);
    const salesBillsRef = useRef(salesBills);

    useEffect(() => {
        productsRef.current = products;
    }, [products]);

    useEffect(() => {
        purchaseBillsRef.current = purchaseBills;
    }, [purchaseBills]);

    useEffect(() => {
        salesBillsRef.current = salesBills;
    }, [salesBills]);

    // --- Initial Firebase Setup and Authentication Listener ---
    useEffect(() => {
        const setupFirebase = async () => {
            await initializeFirebaseAndAuth(); // Initialize Firebase and sign in

            // Set up auth state observer
            const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    console.log("PurchasePage: Auth state changed, user ID:", user.uid);
                } else {
                    setUserId(null);
                    console.log("PurchasePage: Auth state changed, no user (anonymous or logged out).");
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

        console.log("PurchasePage Firestore: Setting up products snapshot listener...");
        const productsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/products`);
        const unsubscribe = onSnapshot(productsCollectionRef, (snapshot) => {
            const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const processedProducts = productsData.map(p => ({
                ...p,
                mrp: Number(p.mrp) || 0,
                originalMrp: Number(p.originalMrp) || 0,
                itemsPerPack: Number(p.itemsPerPack) || 1,
                minStock: Number(p.minStock) || 0,
                maxStock: Number(p.maxStock) || 0,
                discount: Number(p.discount) || 0,
            }));
            setProducts(processedProducts);
            setLoading(false); // Set loading to false once products are loaded
            console.log("PurchasePage Firestore: Products data loaded.");
        }, (error) => {
            console.error("PurchasePage Firestore Products Error:", error);
            setError("Error loading product data from cloud.");
            setLoading(false);
            toast.error("Error loading product data.");
        });

        return () => unsubscribe();
    }, [isAuthReady, userId, appId]);

    // Load Purchase Bills Data from Firestore
    useEffect(() => {
        if (!isAuthReady || !userId) return;

        console.log("PurchasePage Firestore: Setting up purchase bills snapshot listener...");
        const purchaseBillsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
        const unsubscribe = onSnapshot(purchaseBillsCollectionRef, (snapshot) => {
            const bills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const processedBills = bills.map(bill => ({
                ...bill,
                date: bill.date || '',
                items: bill.items.map(item => ({
                    ...item,
                    quantity: Number(item.quantity) || 0,
                    packsPurchased: Number(item.packsPurchased) || 0,
                    itemsPerPack: Number(item.itemsPerPack) || 1,
                    ptr: Number(item.ptr) || 0,
                    mrp: Number(item.mrp) || 0,
                    originalMrp: Number(item.originalMrp) || 0,
                    discount: Number(item.discount) || 0,
                    taxRate: Number(item.taxRate) || 0,
                    totalItemAmount: Number(item.totalItemAmount) || 0,
                })),
                totalAmount: Number(bill.totalAmount) || 0,
            }));
            setPurchaseBills(processedBills);
            console.log("PurchasePage Firestore: Purchase bills data loaded.");
        }, (error) => {
            console.error("PurchasePage Firestore Purchase Bills Error:", error);
            setError("Error loading purchase bill data from cloud.");
            toast.error("Error loading purchase bills.");
        });

        return () => unsubscribe();
    }, [isAuthReady, userId, appId]);

    // Load Sales Bills Data from Firestore
    useEffect(() => {
        if (!isAuthReady || !userId) return;

        console.log("PurchasePage Firestore: Setting up sales bills snapshot listener...");
        const salesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/sales`);
        const unsubscribe = onSnapshot(salesCollectionRef, (snapshot) => {
            const bills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const processedBills = bills.map(bill => ({
                ...bill,
                items: bill.items.map(item => ({
                    ...item,
                    quantity: Number(item.quantity) || 0, // Changed from quantitySold
                    salePrice: Number(item.salePrice) || 0, // Changed from pricePerItem
                    discount: Number(item.discount) || 0,
                    itemTotal: Number(item.itemTotal) || 0, // Changed from totalItemAmount
                    mrp: Number(item.mrp) || 0, // Changed from productMrp
                    itemsPerPack: Number(item.itemsPerPack) || 1, // Changed from productItemsPerPack
                    purchasedMrp: Number(item.purchasedMrp) || 0,
                }))
            }));
            setSalesBills(processedBills);
            console.log("PurchasePage Firestore: Sales bills data loaded.");
        }, (error) => {
            console.error("PurchasePage Firestore Sales Bills Error:", error);
            setError("Error loading sales bills from cloud.");
            toast.error("Error loading sales bills.");
        });

        return () => unsubscribe();
    }, [isAuthReady, userId, appId]);

    // Load Suppliers Data from Firestore for suggestions
    useEffect(() => {
        if (!isAuthReady || !userId) return;

        console.log("PurchasePage Firestore: Setting up suppliers snapshot listener...");
        const suppliersCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/suppliers`);
        const unsubscribe = onSnapshot(suppliersCollectionRef, (snapshot) => {
            const suppliersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSuppliers(suppliersData);
            console.log("PurchasePage Firestore: Suppliers data loaded for suggestions.");
        }, (error) => {
            console.error("PurchasePage Firestore Suppliers Error:", error);
            toast.error("Error loading supplier data for suggestions.");
        });

        return () => unsubscribe();
    }, [isAuthReady, userId, appId]);


    // Data update event listener (still useful for other pages to trigger re-renders)
    // This listener will now cause the Firestore onSnapshot listeners to re-evaluate,
    // effectively reloading data if underlying data changes (e.g., from other tabs).
    useEffect(() => {
        const handleDataUpdated = () => {
            console.log("PurchasePage: Data update event received. Firestore listeners will handle reload.");
            // The onSnapshot listeners above will automatically update state when data changes in Firestore.
            // No explicit load functions needed here anymore, just a log for awareness.
        };

        window.addEventListener("productsUpdated", handleDataUpdated);
        window.addEventListener("purchaseBillsUpdated", handleDataUpdated);
        window.addEventListener("salesUpdated", handleDataUpdated); // Corrected event name from salesBillsUpdated
        window.addEventListener("suppliersUpdated", handleDataUpdated); // Listen for supplier updates

        return () => {
            window.removeEventListener("productsUpdated", handleDataUpdated);
            window.removeEventListener("purchaseBillsUpdated", handleDataUpdated);
            window.removeEventListener("salesUpdated", handleDataUpdated);
            window.removeEventListener("suppliersUpdated", handleDataUpdated);
        };
    }, []); // Empty dependency array as it just sets up the listeners


    // Function to calculate stock by batch for a product (using refs for latest data)
    const getStockByBatch = useCallback((productName) => {
        const batchMap = new Map();

        purchaseBillsRef.current.forEach(bill => {
            bill.items.forEach(item => {
                if (item.product.toLowerCase() === productName.toLowerCase()) {
                    const key = `${item.batch.trim()}_${item.expiry.trim()}`;
                    batchMap.set(key, (batchMap.get(key) || 0) + Number(item.quantity));
                }
            });
        });

        salesBillsRef.current.forEach(bill => {
            bill.items.forEach(item => {
                if (item.productName.toLowerCase() === productName.toLowerCase()) { // Corrected from item.product
                    const key = `${item.batch.trim()}_${item.expiry.trim()}`;
                    batchMap.set(key, Math.max(0, (batchMap.get(key) || 0) - Number(item.quantity))); // Corrected from quantitySold
                }
            });
        });

        return Array.from(batchMap.entries()).map(([key, quantity]) => {
            const [batch, expiry] = key.split('_');
            return { batch, expiry, quantity };
        }).filter(batch => batch.quantity > 0).sort((a, b) => {
            const dateA = parseDate(a.expiry);
            const dateB = parseDate(b.expiry);
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateA - dateB;
        });
    }, []); // No direct state dependencies, uses refs

    // Helper function to calculate total stock for a product, for display
    const calculateTotalStockForProduct = useCallback((productName) => {
        const batchStocks = getStockByBatch(productName);
        return batchStocks.reduce((sum, batch) => sum + batch.quantity, 0);
    }, [getStockByBatch]); // Dependency on getStockByBatch


    // --- Product Search & Selection Logic ---
    const filterProducts = useMemo(() => {
        if (!productSearchTerm) {
            return [];
        }
        const lowerCaseSearchTerm = productSearchTerm.toLowerCase();
        return products.filter(product =>
            product.name.toLowerCase().includes(lowerCaseSearchTerm) ||
            product.category.toLowerCase().includes(lowerCaseSearchTerm) ||
            product.company.toLowerCase().includes(lowerCaseSearchTerm)
            // Removed batch from product master search as it's not a master field
        ).map(product => ({
            ...product,
            // Add calculated current stock for display in the product Browse list
            calculatedCurrentStock: calculateTotalStockForProduct(product.name)
        }));
    }, [productSearchTerm, products, calculateTotalStockForProduct]); // Dependency on calculatedCurrentStock

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        setNewBatch('');
        setNewExpiry('');
        setNewQuantity('');
        setNewPTR(product.ptr || ''); // Pre-fill with master PTR if available
        setNewMRP(product.mrp || ''); // Pre-fill with master MRP if available
        setNewDiscount(product.discount || ''); // Pre-fill with master discount if available
    };

    const handleAddProductToBill = () => {
        if (!selectedProduct) {
            toast.error("Please select a product.");
            return;
        }
        if (!newQuantity || Number(newQuantity) <= 0) { // Ensure quantity is positive
            toast.error("Quantity must be a positive number.");
            return;
        }
        if (!newBatch.trim()) { // Ensure batch is not just whitespace
            toast.error("Batch number is required.");
            return;
        }
        if (!newExpiry.trim()) { // Ensure expiry is not just whitespace
            toast.error("Expiry date is required.");
            return;
        }
        if (Number(newPTR) < 0) { // Allow 0, but not negative
            toast.error("PTR (Price To Retailer) is required and must be non-negative.");
            return;
        }
        if (Number(newMRP) < 0) { // Allow 0, but not negative
            toast.error("MRP is required and must be non-negative.");
            return;
        }
        if (Number(newDiscount) < 0 || Number(newDiscount) > 100) { // Allow 0-100
            toast.error("Discount must be between 0 and 100.");
            return;
        }

        const quantity = Number(newQuantity);
        const ptr = Number(newPTR);
        const mrp = Number(newMRP);
        const discount = Number(newDiscount);

        const currentItem = {
            id: selectedProduct.id, // Keep product ID for potential future lookup
            product: selectedProduct.name,
            batch: newBatch.trim(),
            expiry: newExpiry.trim(),
            quantity: quantity,
            packsPurchased: quantity / (selectedProduct.itemsPerPack || 1), // Calculate packs
            itemsPerPack: selectedProduct.itemsPerPack || 1, // Store items per pack
            ptr: ptr,
            mrp: mrp, // Purchased MRP for this bill item
            originalMrp: selectedProduct.mrp, // Store original master MRP at time of purchase
            unit: selectedProduct.unit,
            category: selectedProduct.category,
            company: selectedProduct.company,
            discount: discount, // Discount for this purchased item
            taxRate: selectedProduct.taxRate || 0, // Assuming taxRate from master if not specified in purchase
            totalItemAmount: (quantity / (selectedProduct.itemsPerPack || 1)) * ptr * (1 - discount / 100), // MODIFIED: Calculate total for this item based on packs
        };

        setCurrentPurchaseItems((prevItems) => [...prevItems, currentItem]);
        toast.success(`${selectedProduct.name} (Batch: ${newBatch}) added to bill.`);

        // Reset fields
        setSelectedProduct(null);
        setProductSearchTerm('');
        setNewBatch('');
        setNewExpiry('');
        setNewQuantity('');
        setNewPTR('');
        setNewMRP('');
        setNewDiscount('');
        setIsAddProductModalOpen(false);
    };

    const handleRemoveItem = (index) => {
        setCurrentPurchaseItems((prevItems) => prevItems.filter((_, i) => i !== index));
        toast.info("Item removed from bill.");
    };

    // --- Enable Editing of Current Purchase Items ---
    const handleItemChange = useCallback((index, field, value) => {
        setCurrentPurchaseItems(prevItems => {
            const updatedItems = [...prevItems];
            const itemToUpdate = { ...updatedItems[index] };

            let parsedValue = value;
            if (['quantity', 'ptr', 'mrp', 'discount', 'packsPurchased', 'itemsPerPack', 'taxRate'].includes(field)) {
                parsedValue = Number(value);
                if (isNaN(parsedValue)) {
                    // Optionally set to 0 or previous valid value if input is not a number
                    parsedValue = 0;
                    if (field === 'discount' && value === '') parsedValue = 0; // Allow empty string for discount to clear it
                }
            }

            itemToUpdate[field] = parsedValue;

            // Define variables here, after itemToUpdate[field] has been updated
            const quantity = Number(itemToUpdate.quantity) || 0;
            const ptr = Number(itemToUpdate.ptr) || 0;
            const discount = Number(itemToUpdate.discount) || 0;
            const itemsPerPack = Number(itemToUpdate.itemsPerPack) || 1;

            // Recalculate totalItemAmount if relevant fields change
            if (field === 'quantity' || field === 'ptr' || field === 'discount' || field === 'itemsPerPack') {
                itemToUpdate.totalItemAmount = (quantity / itemsPerPack) * ptr * (1 - discount / 100);
            }

            // Recalculate packsPurchased if quantity or itemsPerPack changes
            if (field === 'quantity' || field === 'itemsPerPack') {
                itemToUpdate.packsPurchased = quantity / itemsPerPack;
            }

            updatedItems[index] = itemToUpdate;
            return updatedItems;
        });
    }, []);


    // --- Total Amount Calculation ---
    useEffect(() => {
        const calculatedTotal = currentPurchaseItems.reduce((sum, item) => sum + (item.totalItemAmount || 0), 0);
        setTotalAmount(calculatedTotal);
    }, [currentPurchaseItems]);

    // --- Supplier Name Input with Suggestions ---
    const handleSupplierNameChange = (e) => {
        const value = e.target.value;
        setSupplierName(value);
        if (value.length > 0) {
            const filtered = suppliers.filter(s =>
                s.name.toLowerCase().includes(value.toLowerCase())
            );
            setSupplierSuggestions(filtered);
            setIsSupplierListVisible(true);
        } else {
            setSupplierSuggestions([]);
            setIsSupplierListVisible(false);
        }
    };

    const handleSelectSupplier = (supplier) => {
        setSupplierName(supplier.name);
        setIsSupplierListVisible(false); // Hide suggestions after selection
    };

    // --- Save/Update Bill Logic (Firestore Integration) ---
    const handleSaveBill = async () => {
        if (!userId) {
            toast.error("User not authenticated. Cannot save bill.");
            return;
        }
        if (!billNumber.trim() || !billDate.trim() || !supplierName.trim() || currentPurchaseItems.length === 0) {
            toast.error("Please fill all bill details and add at least one item.");
            return;
        }

        // Auto-save new supplier if not existing
        const existingSupplier = suppliers.find(s => s.name.toLowerCase() === supplierName.trim().toLowerCase());
        if (!existingSupplier) {
            try {
                const newSupplierData = {
                    name: supplierName.trim(),
                    contactPerson: '',
                    phone: '',
                    email: '',
                    address: '',
                    gstin: '',
                };
                const suppliersCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/suppliers`);
                await addDoc(suppliersCollectionRef, newSupplierData);
                toast.success(`New supplier "${supplierName}" added automatically.`);
                // Dispatch event to update suppliers list on other pages (e.g., SupplierMasterPage)
                window.dispatchEvent(new Event('suppliersUpdated'));
            } catch (e) {
                console.error("Error auto-saving new supplier: ", e);
                toast.error(`Failed to auto-save new supplier "${supplierName}".`);
                return; // Prevent bill from saving if supplier auto-save fails
            }
        }


        const billToSave = {
            billNumber: billNumber.trim(),
            date: billDate,
            supplierName: supplierName.trim(),
            items: currentPurchaseItems.map(item => ({
                ...item,
                quantity: Number(item.quantity),
                packsPurchased: Number(item.packsPurchased),
                ptr: Number(item.ptr),
                mrp: Number(item.mrp),
                originalMrp: Number(item.originalMrp),
                discount: Number(item.discount),
                taxRate: Number(item.taxRate),
                totalItemAmount: Number(item.totalItemAmount),
            })),
            totalAmount: Number(totalAmount),
        };

        try {
            const purchaseBillsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
            if (isEditingBill) {
                await updateDoc(doc(purchaseBillsCollectionRef, editBillId), billToSave);
                toast.success(`Purchase Bill ${billNumber} updated successfully!`);
            } else {
                await addDoc(purchaseBillsCollectionRef, billToSave);
                toast.success(`Purchase Bill ${billNumber} saved successfully!`);
            }
            dispatchDataUpdatedEvent('purchaseBillsUpdated'); // Notify other components
            dispatchDataUpdatedEvent('productsUpdated'); // Notify product master page for stock recalculation

            resetForm();
        } catch (error) {
            console.error("Error saving purchase bill to Firestore: ", error);
            toast.error("Failed to save purchase bill to cloud.");
        }
    };

    const resetForm = () => {
        setBillNumber('');
        setBillDate(formatDate(new Date()));
        setSupplierName('');
        setSupplierSuggestions([]); // Clear suggestions
        setIsSupplierListVisible(false); // Hide suggestions
        setCurrentPurchaseItems([]);
        setTotalAmount(0);
        setIsEditingBill(false);
        setEditBillId(null);
    };

    const handleEditBill = (billId) => {
        const billToEdit = purchaseBills.find(bill => bill.id === billId);
        if (billToEdit) {
            setBillNumber(billToEdit.billNumber);
            setBillDate(billToEdit.date);
            setSupplierName(billToEdit.supplierName);
            setCurrentPurchaseItems(billToEdit.items);
            setTotalAmount(billToEdit.totalAmount);
            setIsEditingBill(true);
            setEditBillId(billToEdit.id);
            toast.info(`Editing Bill No: ${billToEdit.billNumber}`);
            setViewBillModalOpen(false); // Close view modal if open
            window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top of the form
        } else {
            toast.error("Bill not found for editing.");
        }
    };

    const handleDeleteBill = async (billId) => {
        if (!userId) {
            toast.error("User not authenticated. Cannot delete bill.");
            return;
        }
        // Using a toast for confirmation instead of window.confirm
        toast.info("Deleting purchase bill...", { duration: 1000 }); // Provide immediate feedback

        try {
            const purchaseBillsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
            await deleteDoc(doc(purchaseBillsCollectionRef, billId));
            toast.success("Purchase bill deleted successfully!");
            dispatchDataUpdatedEvent('purchaseBillsUpdated'); // Notify other components
            dispatchDataUpdatedEvent('productsUpdated'); // Notify product master page for stock recalculation
            setViewBillModalOpen(false); // Close view modal if open
        } catch (error) {
            console.error("Error deleting purchase bill from Firestore: ", error);
            toast.error("Failed to delete purchase bill from cloud.");
        }
    };

    // --- PDF Export ---
    const exportBillToPDF = (bill) => {
        const input = document.getElementById(`bill-pdf-content-${bill.id}`);
        if (!input) {
            toast.error("Could not find bill content for PDF export.");
            return;
        }

        toast.info("Generating PDF, please wait...");

        html2canvas(input, { scale: 2 }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
            pdf.save(`Purchase_Bill_${bill.billNumber}.pdf`);
            toast.success("Bill exported to PDF!");
        }).catch(err => {
            console.error("Error exporting to PDF:", err);
            toast.error("Failed to export bill to PDF.");
        });
    };

    // --- Dispatch Custom Event ---
    const dispatchDataUpdatedEvent = (eventName) => {
        const event = new Event(eventName);
        window.dispatchEvent(event);
    };

    // --- Pagination and Sorting for All Bills ---
    const [currentPage, setCurrentPage] = useState(1);
    const [billsPerPage] = useState(10);
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'descending' });

    const sortedBills = useMemo(() => {
        let sortableBills = [...purchaseBills];
        if (sortConfig.key) {
            sortableBills.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (sortConfig.key === 'date') {
                    aValue = parseDate(a.date);
                    bValue = parseDate(b.date);
                    if (!aValue && !bValue) return 0;
                    if (!aValue) return 1;
                    if (!bValue) return -1;
                } else if (typeof aValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableBills;
    }, [purchaseBills, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const indexOfLastBill = currentPage * billsPerPage;
    const indexOfFirstBill = indexOfLastBill - billsPerPage;
    const currentBills = sortedBills.slice(indexOfFirstBill, indexOfLastBill);

    const totalPages = Math.ceil(sortedBills.length / billsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);


    if (loading || !isAuthReady) { // Combined loading check
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="loader"></div>
                <p className="ml-4 text-gray-700">Loading data and authenticating...</p>
            </div>
        );
    }

    if (error) { // Display error if any
        return (
            <div className="flex justify-center items-center h-screen text-red-600">
                <p>{error}</p>
            </div>
        );
    }

    return (
        <>
            <Header />
            <div className="container mx-auto px-4 py-8 bg-gray-100 rounded-lg shadow-inner min-h-[calc(100vh-80px)] fade-in">
                <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-3 border-gray-300">
                    {isEditingBill ? `Edit Purchase Bill: ${billNumber}` : "New Purchase Bill"}
                </h2>

                {/* Display User ID (MANDATORY for multi-user apps) */}
                {/* {userId && (
                    <div className="mb-4 p-3 bg-gray-200 rounded-md text-sm text-gray-700">
                        <span className="font-semibold">Current User ID:</span> {userId}
                    </div>
                )} */}

                {/* Bill Details Form */}
                <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                        <div>
                            <label htmlFor="billNumber" className="block text-sm font-medium text-gray-700 mb-1">Bill Number</label>
                            <input
                                type="text"
                                id="billNumber"
                                value={billNumber}
                                onChange={(e) => setBillNumber(e.target.value)}
                                placeholder="Enter Bill Number"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="billDate" className="block text-sm font-medium text-gray-700 mb-1">Bill Date</label>
                            <input
                                type="text"
                                id="billDate"
                                value={billDate}
                                onChange={(e) => setBillDate(e.target.value)}
                                placeholder="DD-MM-YYYY"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>
                        <div className="relative"> {/* Added relative for positioning suggestions */}
                            <label htmlFor="supplierName" className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
                            <input
                                type="text"
                                id="supplierName"
                                value={supplierName}
                                onChange={handleSupplierNameChange}
                                onFocus={() => setIsSupplierListVisible(true)}
                                onBlur={() => setTimeout(() => setIsSupplierListVisible(false), 200)}
                                placeholder="Enter Supplier Name"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                            {isSupplierListVisible && supplierSuggestions.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto mt-1">
                                    {supplierSuggestions.map(supplier => (
                                        <li
                                            key={supplier.id}
                                            onMouseDown={() => handleSelectSupplier(supplier)} // Use onMouseDown to trigger before onBlur
                                            className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-gray-800 text-sm"
                                        >
                                            {supplier.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {isSupplierListVisible && supplierSuggestions.length === 0 && supplierName.length > 0 && (
                                <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto mt-1 px-3 py-2 text-sm text-gray-500">
                                    No existing suppliers found. A new one will be created upon saving.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Add Product Button */}
                    <Button
                        onClick={() => setIsAddProductModalOpen(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                    >
                        <Plus className="mr-2 h-5 w-5" /> Add Product
                    </Button>
                </div>

                {/* Current Purchase Items Table */}
                <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                    <h3 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-3">Items in this Bill</h3>
                    {currentPurchaseItems.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No items added to this bill yet. Click "Add Product" to start.</p>
                    ) : (
                        <div className="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry (MM-YY)</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity (Items)</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Packs Purchased</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PTR/Item</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MRP/Item</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount (%)</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Total</th>
                                        <th scope="col" className="relative px-3 py-3"><span className="sr-only">Remove</span></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {currentPurchaseItems.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {item.product} ({item.unit})
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="text"
                                                    value={item.batch}
                                                    onChange={(e) => handleItemChange(index, 'batch', e.target.value)}
                                                    className="w-24 p-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="text"
                                                    value={item.expiry}
                                                    onChange={(e) => handleItemChange(index, 'expiry', e.target.value)}
                                                    placeholder="MM-YY"
                                                    className="w-24 p-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                    className="w-24 p-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                {/* Packs purchased is derived, not directly editable */}
                                                {(item.quantity / item.itemsPerPack).toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="number"
                                                    value={item.ptr}
                                                    onChange={(e) => handleItemChange(index, 'ptr', e.target.value)}
                                                    className="w-24 p-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="number"
                                                    value={item.mrp}
                                                    onChange={(e) => handleItemChange(index, 'mrp', e.target.value)}
                                                    className="w-24 p-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="number"
                                                    value={item.discount}
                                                    onChange={(e) => handleItemChange(index, 'discount', e.target.value)}
                                                    className="w-20 p-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                ₹{Number(item.totalItemAmount).toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                                                <Button
                                                    onClick={() => handleRemoveItem(index)}
                                                    className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-100 transition-colors duration-200"
                                                    title="Remove Item"
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div className="mt-4 text-right text-lg font-bold text-gray-800">
                        Total Bill Amount: ₹{totalAmount.toFixed(2)}
                    </div>
                </div>

                {/* Save/Reset Bill Buttons */}
                <div className="flex justify-end space-x-3">
                    <Button
                        onClick={handleSaveBill}
                        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
                    >
                        <Save className="mr-2 h-5 w-5" /> {isEditingBill ? 'Update Bill' : 'Save Bill'}
                    </Button>
                    <Button
                        onClick={resetForm}
                        className="inline-flex items-center px-6 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                    >
                        <RefreshCcw className="mr-2 h-5 w-5" /> {isEditingBill ? 'Cancel Edit' : 'Reset Form'}
                    </Button>
                </div>

                <hr className="my-10 border-gray-300" />

                {/* All Purchase Bills Section */}
                <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-3 border-gray-300">All Purchase Bills</h2>
                <div className="bg-white p-6 rounded-lg shadow-md">
                    {purchaseBills.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No purchase bills recorded yet.</p>
                    ) : (
                        <div className="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('billNumber')}>
                                            Bill Number
                                            <ArrowDownUp className="ml-1 inline h-4 w-4 text-gray-400" />
                                        </th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('date')}>
                                            Date
                                            <ArrowDownUp className="ml-1 inline h-4 w-4 text-gray-400" />
                                        </th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('supplierName')}>
                                            Supplier Name
                                            <ArrowDownUp className="ml-1 inline h-4 w-4 text-gray-400" />
                                        </th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('totalAmount')}>
                                            Total Amount
                                            <ArrowDownUp className="ml-1 inline h-4 w-4 text-gray-400" />
                                        </th>
                                        <th scope="col" className="relative px-3 py-3"><span className="sr-only">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {currentBills.map((bill) => (
                                        <tr key={bill.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{bill.billNumber}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{bill.date}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{bill.supplierName}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">₹{Number(bill.totalAmount).toFixed(2)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                <Button
                                                    onClick={() => { setSelectedBillForView(bill); setViewBillModalOpen(true); }}
                                                    className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-100 transition-colors duration-200"
                                                    title="View Bill Details"
                                                >
                                                    <Eye className="h-5 w-5" />
                                                </Button>
                                                <Button
                                                    onClick={() => handleEditBill(bill.id)}
                                                    className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-100 transition-colors duration-200"
                                                    title="Edit Bill"
                                                >
                                                    <Edit className="h-5 w-5" />
                                                </Button>
                                                <Button
                                                    onClick={() => handleDeleteBill(bill.id)}
                                                    className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-100 transition-colors duration-200"
                                                    title="Delete Bill"
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center space-x-2 mt-4">
                            <Button
                                onClick={() => paginate(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                                title="Previous Page"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <Button
                                    key={page}
                                    onClick={() => paginate(page)}
                                    className={`px-3 py-1 rounded-md ${currentPage === page ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                >
                                    {page}
                                </Button>
                            ))}
                            <Button
                                onClick={() => paginate(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                                title="Next Page"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Product Modal */}
            {isAddProductModalOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 animate-fade-in-backdrop">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl animate-scale-in flex flex-col max-h-[90vh]">
                        <div className="modal-sticky-header p-6 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-xl font-semibold text-gray-800">Add Product to Bill</h3>
                            <Button
                                onClick={() => setIsAddProductModalOpen(false)}
                                className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                                title="Close"
                            >
                                <X className="h-6 w-6 text-gray-600" />
                            </Button>
                        </div>
                        <div className="p-6 flex-grow overflow-y-auto">
                            <div className="mb-4">
                                <label htmlFor="productSearch" className="block text-sm font-medium text-gray-700 mb-1">Search Product</label>
                                <input
                                    type="text"
                                    id="productSearch"
                                    value={productSearchTerm}
                                    onChange={(e) => setProductSearchTerm(e.target.value)}
                                    placeholder="Search by name, category, company"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>

                            {/* Product Search Results */}
                            {filterProducts.length > 0 && (
                                <div className="mb-4 max-h-60 overflow-y-auto border border-gray-200 rounded-md shadow-sm">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock (Items)</th>
                                                <th scope="col" className="relative px-3 py-2"><span className="sr-only">Select</span></th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {filterProducts.map((product) => (
                                                <tr key={product.id} className="hover:bg-gray-100 cursor-pointer" onClick={() => handleProductSelect(product)}>
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{product.category}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{product.company}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{product.calculatedCurrentStock}</td> {/* Use calculated stock */}
                                                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                                                        <Button
                                                            onClick={() => handleProductSelect(product)}
                                                            className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-100"
                                                        >
                                                            Select
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {selectedProduct && (
                                <div className="mt-4 p-4 border border-blue-200 bg-blue-50 rounded-md">
                                    <h4 className="text-lg font-semibold text-blue-800 mb-2">Selected Product: {selectedProduct.name}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="newBatch" className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                                            <input
                                                type="text"
                                                id="newBatch"
                                                value={newBatch}
                                                onChange={(e) => setNewBatch(e.target.value)}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="newExpiry" className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (MM-YY)</label>
                                            <input
                                                type="text"
                                                id="newExpiry"
                                                value={newExpiry}
                                                onChange={(e) => setNewExpiry(e.target.value)}
                                                placeholder="MM-YY"
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="newQuantity" className="block text-sm font-medium text-gray-700 mb-1">Quantity (Items)</label>
                                            <input
                                                type="number"
                                                id="newQuantity"
                                                value={newQuantity}
                                                onChange={(e) => setNewQuantity(e.target.value)}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="newPTR" className="block text-sm font-medium text-gray-700 mb-1">PTR/Item</label>
                                            <input
                                                type="number"
                                                id="newPTR"
                                                value={newPTR}
                                                onChange={(e) => setNewPTR(e.target.value)}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="newMRP" className="block text-sm font-medium text-gray-700 mb-1">MRP/Item</label>
                                            <input
                                                type="number"
                                                id="newMRP"
                                                value={newMRP}
                                                onChange={(e) => setNewMRP(e.target.value)}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="newDiscount" className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                                            <input
                                                type="number"
                                                id="newDiscount"
                                                value={newDiscount}
                                                onChange={(e) => setNewDiscount(e.target.value)}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-sticky-footer p-6 border-t border-gray-200 flex justify-end space-x-3">
                            <Button
                                onClick={() => setIsAddProductModalOpen(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddProductToBill}
                                className="px-4 py-2 border border-transparent rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200"
                            >
                                Add to Bill
                            </Button>
                        </div>
                    </div>
                </div>
            )}


            {/* View Bill Modal */}
            {viewBillModalOpen && selectedBillForView && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 animate-fade-in-backdrop">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl animate-scale-in flex flex-col max-h-[90vh]">
                        <div className="modal-sticky-header p-6 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-xl font-semibold text-gray-800">View Purchase Bill: {selectedBillForView.billNumber}</h3>
                            <Button
                                onClick={() => setViewBillModalOpen(false)}
                                className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                                title="Close"
                            >
                                <X className="h-6 w-6 text-gray-600" />
                            </Button>
                        </div>
                        <div className="p-6 flex-grow overflow-y-auto" id={`bill-pdf-content-${selectedBillForView.id}`}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Bill Number:</p>
                                    <p className="text-md text-gray-900 font-semibold">{selectedBillForView.billNumber}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Bill Date:</p>
                                    <p className="text-md text-gray-900 font-semibold">{selectedBillForView.date}</p>
                                </div>
                                <div className="md:col-span-2">
                                    <p className="text-sm font-medium text-gray-700">Supplier Name:</p>
                                    <p className="text-md text-gray-900 font-semibold">{selectedBillForView.supplierName}</p>
                                </div>
                            </div>

                            <h4 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Items Purchased</h4>
                            <div className="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty (Items)</th>
                                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PTR/Item</th>
                                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MRP/Item</th>
                                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount (%)</th>
                                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {selectedBillForView.items.map((item, index) => (
                                            <tr key={index}>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{item.product} ({item.unit})</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{item.batch}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{item.expiry}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{item.quantity}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">₹{Number(item.ptr).toFixed(2)}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">₹{Number(item.mrp).toFixed(2)}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">{Number(item.discount).toFixed(2)}%</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">₹{Number(item.totalItemAmount).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-6 text-right text-xl font-bold text-gray-800">
                                Total Bill Amount: ₹{Number(selectedBillForView.totalAmount).toFixed(2)}
                            </div>
                        </div>
                        <div className="modal-sticky-footer p-6 border-t border-gray-200 flex justify-end space-x-3">
                            <Button
                                onClick={() => exportBillToPDF(selectedBillForView)}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                            >
                                <Printer className="mr-2 h-5 w-5" /> Export to PDF
                            </Button>
                            <Button
                                onClick={() => {
                                    // This assumes you have a way to share the PDF, e.g., via a generated link
                                    // or by triggering a native share dialog. For now, it's a placeholder.
                                    toast.info("Share functionality coming soon!");
                                }}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors duration-200"
                            >
                                <Share2 className="mr-2 h-5 w-5" /> Share Bill
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                /* Loader styles */
                .loader {
                    border: 4px solid #f3f3f3; /* Light grey */
                    border-top: 4px solid #3498db; /* Blue */
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                /* Fade-in animations */
                .animate-fade-in-backdrop {
                    animation: fadeInBackdrop 0.3s ease-out forwards;
                }
                @keyframes fadeInBackdrop {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }

                .animate-scale-in {
                    animation: scaleIn 0.3s ease-out forwards;
                }
                @keyframes scaleIn {
                    0% { transform: scale(0.95); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }

                .fade-in {
                    animation: fadeIn 0.5s ease-out forwards;
                }
                @keyframes fadeIn {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }

                /* Styles for sticky header in modals if needed, though overflow-y on modal box is primary */
                .modal-sticky-header {
                    position: sticky;
                    top: 0;
                    background-color: white; /* or theme background */
                    z-index: 10; /* Ensure it's above content but below modal controls if separate */
                }
                .modal-sticky-footer {
                     position: sticky;
                    bottom: 0;
                    background-color: white; /* or theme background */
                    z-index: 10;
                }
            `}</style>
        </>
    );
};

export default PurchasePage;
    