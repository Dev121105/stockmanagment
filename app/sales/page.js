// app/sales/page.js
"use client"; // This directive is needed for client-side functionality

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '../components/button';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import { toast } from 'sonner';
import { Trash2, Eye, Plus, X, Edit, Save, Share2, Printer, Search, RefreshCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Helper functions (formatDate, parseDate, parseMonthYearDate) remain the same
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
    return null;
}

function parseMonthYearDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
        return null;
    }
    const parts = dateString.split('-');
    if (parts.length !== 2) {
        return null;
    }
    const [month, year] = parts;
    const monthInt = parseInt(month, 10);
    const yearInt = parseInt(year, 10);

    if (month && year && !isNaN(monthInt) && !isNaN(yearInt)) {
        if (monthInt >= 1 && monthInt <= 12 && yearInt >= 0 && yearInt <= 99) {
            const fullYear = 2000 + yearInt;
            return new Date(fullYear, monthInt - 1, 1);
        }
    }
    return null;
}

export default function SalesPage() {
    const [salesBills, setSalesBills] = useState([]);
    const [products, setProducts] = useState([]);
    const [purchaseBills, setPurchaseBills] = useState([]); // Needed for batch stock/MRP lookups
    const [customers, setCustomers] = useState([]); // Needed for customer name suggestions

    const [newBill, setNewBill] = useState({
        billNumber: '',
        date: formatDate(new Date()),
        customerName: '',
        items: [],
        totalAmount: 0,
    });
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [itemDetails, setItemDetails] = useState({
        product: '',
        batch: '',
        expiry: '',
        quantitySold: '',
        pricePerPack: '', // Renamed from pricePerItem to pricePerPack
        discount: '',
        totalItemAmount: 0,
        productMrp: 0,
        productItemsPerPack: 1,
        purchasedMrp: 0,
    });

    // Consolidated and clarified modal state variables
    const [editingBillId, setEditingBillId] = useState(null); // ID of the bill being edited
    const [viewingBill, setViewingBill] = useState(null); // Full bill object being viewed

    // Separate boolean flags for each modal's visibility
    const [isProductModalOpen, setIsProductModalOpen] = useState(false); // Controls product selection modal
    const [isBillModalOpen, setIsBillModalOpen] = useState(false);     // Controls NEW sales bill form modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);     // Controls EDIT sales bill form modal
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);     // Controls VIEW sales bill details modal


    const [searchTerm, setSearchTerm] = useState('');
    const [filteredSalesBills, setFilteredSalesBills] = useState([]);
    const billRef = useRef(); // Ref for the bill content for PDF generation
    const [lastSavedBillNumber, setLastSavedBillNumber] = useState(null); // For auto-generating bill numbers


    const router = useRouter();

    // --- Data Loading Effects ---

    // Load products from localStorage
    const loadProductsFromLocalStorage = useCallback(() => {
        try {
            const storedProducts = localStorage.getItem('products');
            const products = storedProducts ? JSON.parse(storedProducts) : [];
            const processedProducts = products.map(p => ({
                ...p,
                quantity: Number(p.quantity) || 0,
                mrp: Number(p.mrp) || 0,
                originalMrp: Number(p.originalMrp) || 0,
                itemsPerPack: Number(p.itemsPerPack) || 1,
                minStock: Number(p.minStock) || 0,
                maxStock: Number(p.maxStock) || 0,
                discount: Number(p.discount) || 0,
            }));
            setProducts(processedProducts);
            return processedProducts; // Return data for immediate use if needed
        } catch (error) {
            console.error("Error loading products:", error);
            toast.error("Failed to load product master data.");
            setProducts([]);
            return [];
        }
    }, []);

    // Load purchase bills from localStorage
    const loadPurchaseBillsFromLocalStorage = useCallback(() => {
        try {
            const storedBills = localStorage.getItem('purchaseBills');
            const bills = storedBills ? JSON.parse(storedBills) : [];
            const processedBills = bills.map(bill => ({
                ...bill,
                date: bill.date || '',
                items: bill.items.map(item => ({
                    ...item,
                    quantity: Number(item.quantity) || 0,
                    packsPurchased: Number(item.packsPurchased) || 0,
                    itemsPerPack: Number(item.itemsPerPack) || 1,
                    ptr: Number(item.ptr) || 0,
                    mrp: Number(item.mrp) || 0, // MRP from purchase record
                    originalMrp: Number(item.originalMrp) || 0, // Original MRP from product master at purchase time
                    discount: Number(item.discount) || 0,
                    taxRate: Number(item.taxRate) || 0,
                })),
                totalAmount: Number(bill.totalAmount) || 0,
            }));
            setPurchaseBills(processedBills);
            return processedBills;
        } catch (error) {
            console.error("Error loading purchase bills:", error);
            toast.error("Failed to load purchase bill data.");
            setPurchaseBills([]);
            return [];
        }
    }, []);


    // Load sales bills from localStorage
    const loadSalesBillsFromLocalStorage = useCallback(() => {
        try {
            const storedBills = localStorage.getItem('salesBills');
            const bills = storedBills ? JSON.parse(storedBills) : [];
            const processedBills = bills.map(bill => ({
                ...bill,
                date: bill.date ? formatDate(parseDate(bill.date)) : '',
                totalAmount: Number(bill.totalAmount) || 0,
                items: bill.items.map(item => ({
                    ...item,
                    quantitySold: Number(item.quantitySold) || 0,
                    pricePerItem: Number(item.pricePerItem) || 0,
                    discount: Number(item.discount) || 0,
                    totalItemAmount: Number(item.totalItemAmount) || 0,
                    productMrp: Number(item.productMrp) || 0,
                    productItemsPerPack: Number(item.productItemsPerPack) || 1,
                    purchasedMrp: Number(item.purchasedMrp) || 0,
                }))
            }));
            processedBills.sort((a, b) => {
                const dateA = parseDate(a.date);
                const dateB = parseDate(b.date);
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateB - dateA; // Sort by newest date first
            });
            setSalesBills(processedBills);
            setFilteredSalesBills(processedBills); // Initialize filtered bills
            return processedBills;
        } catch (error) {
            console.error("Error loading sales bills:", error);
            toast.error("Failed to load sales bills.");
            setSalesBills([]);
            setFilteredSalesBills([]);
            return [];
        }
    }, []);

    // Load customers from localStorage
    const loadCustomersFromLocalStorage = useCallback(() => {
        try {
            const storedCustomers = localStorage.getItem('customers');
            const parsedCustomers = storedCustomers ? JSON.parse(storedCustomers) : [];
            setCustomers(parsedCustomers);
            return parsedCustomers;
        } catch (error) {
            console.error("Error loading customers:", error);
            toast.error("Failed to load customer data.");
            setCustomers([]);
            return [];
        }
    }, []);

    // Load last sales bill number from localStorage
    const loadLastBillNumber = useCallback(() => {
        try {
            return localStorage.getItem('lastSalesBillNumber') || null;
        } catch (error) {
            console.error("Error loading last bill number:", error);
            return null;
        }
    }, []);

    // Save last sales bill number to localStorage
    const saveLastBillNumber = useCallback((billNumber) => {
        try {
            localStorage.setItem('lastSalesBillNumber', billNumber);
        } catch (error) {
            console.error("Error saving last bill number:", error);
        }
    }, []);


    // Master data loading effect
    useEffect(() => {
        loadProductsFromLocalStorage();
        loadPurchaseBillsFromLocalStorage();
        loadSalesBillsFromLocalStorage();
        loadCustomersFromLocalStorage();
        setLastSavedBillNumber(loadLastBillNumber());

        const handleProductsUpdated = () => {
            loadProductsFromLocalStorage();
            loadPurchaseBillsFromLocalStorage();
        };

        window.addEventListener('productsUpdated', handleProductsUpdated);
        return () => {
            window.removeEventListener('productsUpdated', handleProductsUpdated);
        };
    }, [loadProductsFromLocalStorage, loadPurchaseBillsFromLocalStorage, loadSalesBillsFromLocalStorage, loadCustomersFromLocalStorage, loadLastBillNumber]);

    // Auto-generate Bill Number when not editing and billNumber is empty
    useEffect(() => {
        if (!editingBillId && !isEditModalOpen && newBill.billNumber === '') {
            if (lastSavedBillNumber) {
                try {
                    const numericPart = parseInt(lastSavedBillNumber, 10);
                    if (!isNaN(numericPart)) {
                        const nextNumber = numericPart + 1;
                        setNewBill(prev => ({ ...prev, billNumber: String(nextNumber) }));
                    } else {
                        setNewBill(prev => ({ ...prev, billNumber: '' }));
                        toast.warning("Last bill number is not numeric. Please enter the bill number manually.");
                    }
                } catch (parseError) {
                    setNewBill(prev => ({ ...prev, billNumber: '' }));
                    toast.error("Error auto-generating bill number. Please enter manually.");
                }
            } else {
                setNewBill(prev => ({ ...prev, billNumber: '1001' }));
            }
        }
    }, [lastSavedBillNumber, editingBillId, isEditModalOpen, newBill.billNumber]);


    // --- Search and Filter ---
    useEffect(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const filtered = salesBills.filter(bill =>
            bill.billNumber.toLowerCase().includes(lowerCaseSearchTerm) ||
            bill.customerName.toLowerCase().includes(lowerCaseSearchTerm) ||
            bill.date.toLowerCase().includes(lowerCaseSearchTerm) ||
            bill.items.some(item => item.product.toLowerCase().includes(lowerCaseSearchTerm))
        );
        setFilteredSalesBills(filtered);
    }, [searchTerm, salesBills]);


    // --- Bill Management Functions ---

    const generateBillNumber = useCallback(() => {
        const lastBillNumberFromSales = salesBills.length > 0
            ? Math.max(...salesBills.map(bill => parseInt(bill.billNumber.replace(/[^0-9]/g, ''), 10) || 0))
            : 0;
        const lastSavedNum = lastSavedBillNumber ? parseInt(lastSavedBillNumber, 10) : 0;
        const maxExistingNum = Math.max(lastBillNumberFromSales, lastSavedNum);
        return `${String(maxExistingNum + 1).padStart(4, '0')}`; // Example: SAL-0001 or just 0001
    }, [salesBills, lastSavedBillNumber]);

    const handleNewBillChange = (e) => {
        const { name, value } = e.target;
        setNewBill(prev => ({ ...prev, [name]: value }));
    };

    const handleItemDetailsChange = (e) => {
        const { name, value } = e.target;
        setItemDetails(prev => ({ ...prev, [name]: value }));
    };

    // Memoize batch stock to prevent recalculation on every render
    const batchStock = useMemo(() => {
        const stockMap = new Map(); // Key: "productName_batch_expiry", Value: current quantity in stock

        purchaseBills.forEach(bill => {
            bill.items.forEach(item => {
                if (item.product && item.batch && item.expiry) {
                    const key = `${item.product.trim().toLowerCase()}_${item.batch.trim().toLowerCase()}_${item.expiry.trim().toLowerCase()}`;
                    const quantity = Number(item.quantity) || 0;
                    stockMap.set(key, (stockMap.get(key) || 0) + quantity);
                }
            });
        });

        salesBills.forEach(bill => {
            bill.items.forEach(item => {
                if (item.product && item.batch && item.expiry) {
                    const key = `${item.product.trim().toLowerCase()}_${item.batch.trim().toLowerCase()}_${item.expiry.trim().toLowerCase()}`;
                    const quantitySold = Number(item.quantitySold) || 0;
                    stockMap.set(key, Math.max(0, (stockMap.get(key) || 0) - quantitySold));
                }
            });
        });
        return stockMap;
    }, [purchaseBills, salesBills]);


    const handleProductSelection = (productId) => {
        const product = products.find(p => p.id === productId);
        setSelectedProduct(product);
        if (product) {
            // Find batches for the selected product and calculate available quantities
            const availableBatches = [];
            purchaseBills.forEach(pBill => {
                pBill.items.forEach(pItem => {
                    if (pItem.product.toLowerCase() === product.name.toLowerCase()) {
                        const batchKey = `${pItem.product.trim().toLowerCase()}_${pItem.batch.trim().toLowerCase()}_${pItem.expiry.trim().toLowerCase()}`;
                        const currentStock = batchStock.get(batchKey) || 0;

                        if (currentStock > 0) {
                            availableBatches.push({
                                batch: pItem.batch,
                                expiry: pItem.expiry,
                                currentStock: currentStock,
                                purchasedMrp: Number(pItem.mrp) || Number(product.originalMrp) || 0, // Use purchase MRP, fallback to product's original MRP
                            });
                        }
                    }
                });
            });

            // Remove duplicates and prioritize batches that have stock
            const uniqueBatches = Array.from(new Map(availableBatches.map(b =>
                [`${b.batch}-${b.expiry}`, b])).values());

            setItemDetails(prev => ({
                ...prev,
                product: product.name,
                batch: uniqueBatches[0]?.batch || '', // Pre-select first available batch
                expiry: uniqueBatches[0]?.expiry || '', // Pre-select first available expiry
                pricePerPack: product.mrp, // Set pricePerPack here, as it represents the MRP of the whole pack
                productMrp: product.mrp,
                productItemsPerPack: product.itemsPerPack,
                purchasedMrp: uniqueBatches[0]?.purchasedMrp || 0, // Pre-select purchase MRP for first available batch
            }));
            setIsProductModalOpen(false); // Close modal after selection
        }
    };


    const handleAddItem = () => {
        if (!selectedProduct) {
            toast.error("Please select a product.");
            return;
        }
        if (!itemDetails.batch || !itemDetails.expiry) {
            toast.error("Please select a batch and expiry for the product.");
            return;
        }
        if (!itemDetails.quantitySold || Number(itemDetails.quantitySold) <= 0) {
            toast.error("Please enter a valid quantity.");
            return;
        }
        // Validate pricePerPack, not pricePerItem anymore
        if (!itemDetails.pricePerPack || Number(itemDetails.pricePerPack) <= 0) {
             toast.error("Please enter a valid price per pack.");
             return;
        }

        const quantitySold = Number(itemDetails.quantitySold); // This is individual items
        const pricePerPack = Number(itemDetails.pricePerPack); // This is price per pack
        const itemsPerPack = Number(itemDetails.productItemsPerPack) || 1; // Default to 1 to avoid division by zero
        const discount = Number(itemDetails.discount) || 0;

        // Calculate the actual price per single item
        const actualPricePerItem = pricePerPack / itemsPerPack;

        const batchKey = `${selectedProduct.name.trim().toLowerCase()}_${itemDetails.batch.trim().toLowerCase()}_${itemDetails.expiry.trim().toLowerCase()}`;
        const currentBatchStock = batchStock.get(batchKey) || 0;

        if (quantitySold > currentBatchStock) {
            toast.error(`Not enough stock for ${selectedProduct.name} (Batch: ${itemDetails.batch}, Expiry: ${itemDetails.expiry}). Available: ${currentBatchStock}`);
            return;
        }

        // Calculate total amount based on quantitySold (items) and actualPricePerItem
        const totalItemAmountBeforeDiscount = quantitySold * actualPricePerItem;
        const totalItemAmount = totalItemAmountBeforeDiscount - (totalItemAmountBeforeDiscount * (discount / 100));

        const newItem = {
            id: selectedProduct.id,
            product: itemDetails.product,
            batch: itemDetails.batch,
            expiry: itemDetails.expiry,
            quantitySold: quantitySold, // This remains individual items
            pricePerItem: actualPricePerItem, // Store the actual price per single item
            discount: discount,
            totalItemAmount: totalItemAmount,
            productMrp: itemDetails.productMrp, // This is still the MRP of the pack
            productItemsPerPack: itemDetails.productItemsPerPack,
            purchasedMrp: itemDetails.purchasedMrp, // This is crucial for profit calculation
            unit: selectedProduct.unit,
            category: selectedProduct.category,
            company: selectedProduct.company,
        };

        setNewBill(prev => {
            const updatedItems = [...prev.items, newItem];
            const newTotalAmount = updatedItems.reduce((sum, item) => sum + item.totalItemAmount, 0);
            return {
                ...prev,
                items: updatedItems,
                totalAmount: newTotalAmount,
            };
        });

        // Reset item details and selected product
        setSelectedProduct(null);
        setItemDetails({
            product: '', batch: '', expiry: '', quantitySold: '', pricePerPack: '', discount: '', totalItemAmount: 0,
            productMrp: 0, productItemsPerPack: 1, purchasedMrp: 0,
        });
        toast.success(`${newItem.product} added to bill.`);
    };

    const handleRemoveItem = (index) => {
        setNewBill(prev => {
            const updatedItems = prev.items.filter((_, i) => i !== index);
            const newTotalAmount = updatedItems.reduce((sum, item) => sum + item.totalItemAmount, 0);
            toast.info(`Removed item: ${prev.items[index].product}`);
            return {
                ...prev,
                items: updatedItems,
                totalAmount: newTotalAmount,
            };
        });
    };

    const handleSaveBill = (e) => {
        e.preventDefault();
        if (!newBill.customerName.trim()) {
            toast.error("Customer name is required.");
            return;
        }
        if (newBill.items.length === 0) {
            toast.error("Please add at least one item to the bill.");
            return;
        }

        const billToSave = {
            ...newBill,
            billNumber: newBill.billNumber || generateBillNumber(),
            id: editingBillId || `sales-${Date.now()}`,
            date: formatDate(parseDate(newBill.date) || new Date()),
        };

        let updatedSalesBills;
        if (editingBillId) {
            // Revert stock changes for the original bill items if editing
            const originalBill = salesBills.find(bill => bill.id === editingBillId);
            const productsAfterRevert = products.map(p => {
                const itemInOriginalBill = originalBill?.items.find(item => item.id === p.id);
                if (itemInOriginalBill) {
                    return { ...p, quantity: p.quantity + itemInOriginalBill.quantitySold };
                }
                return p;
            });
            // Then apply new stock changes from the updated bill
            const productsAfterUpdate = productsAfterRevert.map(p => {
                const itemInUpdatedBill = billToSave.items.find(item => item.id === p.id);
                if (itemInUpdatedBill) {
                    return { ...p, quantity: p.quantity - itemInUpdatedBill.quantitySold };
                }
                return p;
            });
            updatedSalesBills = salesBills.map(bill =>
                bill.id === editingBillId ? billToSave : bill
            );
            localStorage.setItem('products', JSON.stringify(productsAfterUpdate));
            setProducts(productsAfterUpdate);
            toast.success("Sales bill updated successfully!");
        } else {
            // Apply stock changes for a new bill
            const productsAfterNewSale = products.map(p => {
                const itemInNewBill = billToSave.items.find(item => item.id === p.id);
                if (itemInNewBill) {
                    return { ...p, quantity: p.quantity - itemInNewBill.quantitySold };
                }
                return p;
            });
            updatedSalesBills = [...salesBills, billToSave];
            localStorage.setItem('products', JSON.stringify(productsAfterNewSale));
            setProducts(productsAfterNewSale);
            toast.success("Sales bill saved successfully!");
        }

        localStorage.setItem('salesBills', JSON.stringify(updatedSalesBills));
        setSalesBills(updatedSalesBills);
        saveLastBillNumber(billToSave.billNumber); // Update last saved bill number
        setLastSavedBillNumber(billToSave.billNumber); // Also update local state

        // Update customer list if new customer name is entered
        if (billToSave.customerName && !customers.includes(billToSave.customerName)) {
            const updatedCustomers = [...customers, billToSave.customerName];
            localStorage.setItem('customers', JSON.stringify(updatedCustomers));
            setCustomers(updatedCustomers);
        }

        // Trigger a custom event to notify other components (e.g., Dashboard)
        window.dispatchEvent(new Event('salesBillsUpdated'));
        window.dispatchEvent(new Event('productsUpdated'));

        resetForm();
        setIsBillModalOpen(false); // Close new bill modal
        setIsEditModalOpen(false); // Close edit bill modal
    };

    const handleEditBill = (billId) => {
        const billToEdit = salesBills.find(bill => bill.id === billId);
        if (billToEdit) {
            setEditingBillId(billId);
            setNewBill({
                billNumber: billToEdit.billNumber,
                date: billToEdit.date,
                customerName: billToEdit.customerName,
                items: billToEdit.items,
                totalAmount: billToEdit.totalAmount,
            });
            setIsEditModalOpen(true); // Open the edit modal
            setIsBillModalOpen(false); // Ensure new bill modal is closed
            setIsViewModalOpen(false); // Ensure view modal is closed
        }
    };

    const handleDeleteBill = (billId) => {
        if (window.confirm("Are you sure you want to delete this sales bill? This action cannot be undone and will revert stock changes.")) {
            const billToDelete = salesBills.find(bill => bill.id === billId);

            // Revert stock changes for deleted bill
            const updatedProducts = products.map(p => {
                const itemInDeletedBill = billToDelete.items.find(item => item.id === p.id);
                if (itemInDeletedBill) {
                    return { ...p, quantity: p.quantity + itemInDeletedBill.quantitySold };
                }
                return p;
            });

            const updatedSalesBills = salesBills.filter(bill => bill.id !== billId);
            localStorage.setItem('salesBills', JSON.stringify(updatedSalesBills));
            localStorage.setItem('products', JSON.stringify(updatedProducts));
            setSalesBills(updatedSalesBills);
            setProducts(updatedProducts);

            // Trigger a custom event to notify other components (e.g., Dashboard)
            window.dispatchEvent(new Event('salesBillsUpdated'));
            window.dispatchEvent(new Event('productsUpdated'));

            toast.success("Sales bill deleted successfully and stock reverted!");
        }
    };

    const resetForm = () => {
        setNewBill({
            billNumber: '',
            date: formatDate(new Date()),
            customerName: '',
            items: [],
            totalAmount: 0,
        });
        setEditingBillId(null);
        setSelectedProduct(null);
        setItemDetails({
            product: '', batch: '', expiry: '', quantitySold: '', pricePerPack: '', discount: '', totalItemAmount: 0, // Changed pricePerItem to pricePerPack
            productMrp: 0, productItemsPerPack: 1, purchasedMrp: 0,
        });
    };

    const handleOpenNewBillModal = () => {
        resetForm();
        setNewBill(prev => ({ ...prev, billNumber: generateBillNumber() }));
        setIsBillModalOpen(true); // Open the new bill modal
        setIsEditModalOpen(false); // Ensure edit modal is closed
        setIsViewModalOpen(false); // Ensure view modal is closed
    };

    // --- Bill Viewing and Sending ---
    const handleViewBill = (bill) => {
        setViewingBill(bill);
        setIsViewModalOpen(true); // Open the dedicated view modal
        setIsBillModalOpen(false); // Ensure new bill modal is closed
        setIsEditModalOpen(false); // Ensure edit modal is closed
    };

    const handlePrintBill = async () => {
        if (!viewingBill) {
            toast.error("No bill selected for printing.");
            return;
        }
        const printContent = document.createElement('div');
        printContent.innerHTML = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ccc; max-width: 800px; margin: auto;">
                <h2 style="text-align: center; color: #333; margin-bottom: 20px;">Sales Invoice</h2>
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                    <div><strong>Bill No:</strong> ${viewingBill.billNumber}</div>
                    <div><strong>Date:</strong> ${viewingBill.date}</div>
                </div>
                <div style="margin-bottom: 20px;">
                    <strong>Customer:</strong> ${viewingBill.customerName}
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f2f2f2;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Product</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Batch</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Expiry</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Qty</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Price/Item</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Disc (%)</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${viewingBill.items.map(item => `
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${item.product}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${item.batch}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${item.expiry}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.quantitySold}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${Number(item.pricePerItem).toFixed(2)}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${Number(item.discount).toFixed(2)}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${Number(item.totalItemAmount).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="6" style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">Total Amount:</td>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">₹${Number(viewingBill.totalAmount).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                <div style="text-align: center; margin-top: 30px; font-size: 0.9em; color: #555;">
                    Thank you for your business!
                </div>
            </div>
        `;

        document.body.appendChild(printContent);
        window.print();
        document.body.removeChild(printContent);
        toast.info("Preparing bill for printing...");
    };

    const handleSendBill = async (billToSend) => {
        const targetBill = billToSend || viewingBill;
        if (!targetBill) {
            toast.error("No bill selected to send.");
            return;
        }

        const tempBillContainer = document.createElement('div');
        tempBillContainer.style.position = 'absolute';
        tempBillContainer.style.left = '-9999px';
        tempBillContainer.style.width = '800px';
        tempBillContainer.innerHTML = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ccc;">
                <h2 style="text-align: center; color: #333; margin-bottom: 20px;">Sales Invoice</h2>
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                    <div><strong>Bill No:</strong> ${targetBill.billNumber}</div>
                    <div><strong>Date:</strong> ${targetBill.date}</div>
                </div>
                <div style="margin-bottom: 20px;">
                    <strong>Customer:</strong> ${targetBill.customerName}
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f2f2f2;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Product</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Batch</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Expiry</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Qty</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Price/Item</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Disc (%)</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${targetBill.items.map(item => `
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${item.product}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${item.batch}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${item.expiry}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.quantitySold}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${Number(item.pricePerItem).toFixed(2)}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${Number(item.discount).toFixed(2)}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${Number(item.totalItemAmount).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="6" style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">Total Amount:</td>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">₹${Number(targetBill.totalAmount).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                <div style="text-align: center; margin-top: 30px; font-size: 0.9em; color: #555;">
                    Thank you for your business!
                </div>
            </div>
        `;
        document.body.appendChild(tempBillContainer);


        try {
            const canvas = await html2canvas(tempBillContainer, {
                scale: 2,
                useCORS: true,
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            const pdfBlob = pdf.output('blob');

            if (navigator.share) {
                await navigator.share({
                    files: [new File([pdfBlob], `${targetBill.billNumber}_${targetBill.customerName}_bill.pdf`, { type: 'application/pdf' })],
                    title: `Sales Bill - ${targetBill.billNumber}`,
                    text: `Here is your sales bill from ${targetBill.date}.`,
                });
                toast.success("Bill shared successfully!");
            } else {
                const url = URL.createObjectURL(pdfBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${targetBill.billNumber}_${targetBill.customerName}_bill.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.info("Bill downloaded. You can share it manually.");
            }
        } catch (error) {
            console.error("Error sending/downloading bill:", error);
            toast.error("Failed to generate or send bill. Please try again.");
        } finally {
            document.body.removeChild(tempBillContainer);
        }
    };


    const memoizedFilteredSalesBills = useMemo(() => filteredSalesBills, [filteredSalesBills]);

    return (
        <div>
            <Header />
            <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 bg-gray-50 rounded-lg shadow-inner min-h-[calc(100vh-80px)]">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-800">Sales Bills</h2>
                    <div className="flex space-x-3">
                        <Button
                            onClick={() => router.push('/')}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
                        >
                            Go to Dashboard
                        </Button>
                        <Button
                            onClick={handleOpenNewBillModal}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add New Sale
                        </Button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search sales bills by bill number, customer, product..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ease-in-out"
                        />
                         {searchTerm && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                            >
                                <X className="h-4 w-4 text-gray-500" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Sales Bills Table */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h3 className="text-2xl font-semibold text-gray-700 mb-4 border-b pb-3 border-gray-200">
                        All Sales Records
                    </h3>
                    {memoizedFilteredSalesBills.length === 0 && !searchTerm ? (
                         <div className="text-center text-gray-500 py-8">
                            <p className="text-lg mb-2">No sales bills recorded yet.</p>
                            <p>Click "Add New Sale" to get started.</p>
                        </div>
                    ) : memoizedFilteredSalesBills.length === 0 && searchTerm ? (
                        <div className="text-center text-gray-500 py-8">
                            <p className="text-lg mb-2">No results found for "{searchTerm}".</p>
                            <Button onClick={() => setSearchTerm('')} className="mt-4 text-sm">
                                <RefreshCcw className="inline-block w-4 h-4 mr-2"/> Clear Search
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-md border border-gray-200 shadow-sm">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Bill No.
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Customer Name
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Total Amount
                                        </th>
                                        <th scope="col" className="relative px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {memoizedFilteredSalesBills.map((bill) => (
                                        <tr key={bill.id} className="hover:bg-gray-50 transition-colors duration-150">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {bill.billNumber}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                {bill.date}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                {bill.customerName}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                                                ₹{Number(bill.totalAmount).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                                <div className="flex items-center justify-center space-x-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleViewBill(bill)}
                                                        className="text-blue-600 hover:text-blue-900 p-1"
                                                        title="View Details"
                                                    >
                                                        <Eye className="h-5 w-5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEditBill(bill.id)}
                                                        className="text-indigo-600 hover:text-indigo-900 p-1"
                                                        title="Edit Bill"
                                                    >
                                                        <Edit className="h-5 w-5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleSendBill(bill)}
                                                        className="text-purple-600 hover:text-purple-900 p-1"
                                                        title="Share Bill"
                                                    >
                                                        <Share2 className="h-5 w-5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteBill(bill.id)}
                                                        className="text-red-600 hover:text-red-900 p-1"
                                                        title="Delete Bill"
                                                    >
                                                        <Trash2 className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* New/Edit Sales Bill Modal (Controlled by isBillModalOpen OR isEditModalOpen) */}
                {(isBillModalOpen || isEditModalOpen) && (
                    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center p-4 z-50 fade-in-backdrop">
                        <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto transform scale-95 opacity-0 animate-scale-in">
                            <div className="flex justify-between items-center mb-6 border-b pb-4">
                                <h3 className="text-2xl font-bold text-gray-800">
                                    {editingBillId ? 'Edit Sales Bill' : 'New Sales Bill'}
                                </h3>
                                <Button
                                    onClick={() => { setIsBillModalOpen(false); setIsEditModalOpen(false); resetForm(); }}
                                    variant="ghost"
                                    size="icon"
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    <X className="h-6 w-6" />
                                </Button>
                            </div>
                            <form onSubmit={handleSaveBill}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label htmlFor="billNumber" className="block text-sm font-medium text-gray-700 mb-1">
                                            Bill Number
                                        </label>
                                        <input
                                            type="text"
                                            id="billNumber"
                                            name="billNumber"
                                            value={newBill.billNumber}
                                            onChange={handleNewBillChange}
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            readOnly={!!editingBillId}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                                            Date (DD-MM-YYYY)
                                        </label>
                                        <input
                                            type="text"
                                            id="date"
                                            name="date"
                                            value={newBill.date}
                                            onChange={handleNewBillChange}
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="DD-MM-YYYY"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">
                                            Customer Name
                                        </label>
                                        <input
                                            type="text"
                                            id="customerName"
                                            name="customerName"
                                            value={newBill.customerName}
                                            onChange={handleNewBillChange}
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            required
                                            list="customerSuggestions"
                                        />
                                        <datalist id="customerSuggestions">
                                            {customers.map((name, index) => (
                                                <option key={index} value={name} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>

                                {/* Product Item Addition */}
                                <div className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
                                    <h4 className="text-lg font-semibold text-gray-700 mb-3">Add Product to Bill</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label htmlFor="product" className="block text-sm font-medium text-gray-700 mb-1">
                                                Product
                                            </label>
                                            <div className="flex">
                                                <input
                                                    type="text"
                                                    id="product"
                                                    name="product"
                                                    value={selectedProduct ? selectedProduct.name : ''}
                                                    readOnly
                                                    className="flex-grow mt-1 block w-full border border-gray-300 rounded-l-md shadow-sm py-2 px-3 focus:outline-none bg-gray-100"
                                                    placeholder="Select a product"
                                                />
                                                <Button
                                                    type="button"
                                                    onClick={() => setIsProductModalOpen(true)}
                                                    className="mt-1 px-4 py-2 border border-l-0 border-gray-300 rounded-r-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    Browse
                                                </Button>
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="batch" className="block text-sm font-medium text-gray-700 mb-1">
                                                Batch No.
                                            </label>
                                            <input
                                                type="text"
                                                id="batch"
                                                name="batch"
                                                value={itemDetails.batch}
                                                onChange={handleItemDetailsChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                                readOnly={!selectedProduct}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="expiry" className="block text-sm font-medium text-gray-700 mb-1">
                                                Expiry (MM-YY)
                                            </label>
                                            <input
                                                type="text"
                                                id="expiry"
                                                name="expiry"
                                                value={itemDetails.expiry}
                                                onChange={handleItemDetailsChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="MM-YY"
                                                readOnly={!selectedProduct}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="quantitySold" className="block text-sm font-medium text-gray-700 mb-1">
                                                Quantity Sold (Items)
                                            </label>
                                            <input
                                                type="number"
                                                id="quantitySold"
                                                name="quantitySold"
                                                value={itemDetails.quantitySold}
                                                onChange={handleItemDetailsChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                                min="1"
                                                readOnly={!selectedProduct}
                                            />
                                            {selectedProduct && itemDetails.quantitySold > (batchStock.get(`${selectedProduct.name.trim().toLowerCase()}_${itemDetails.batch.trim().toLowerCase()}_${itemDetails.expiry.trim().toLowerCase()}`) || 0) && (
                                                <p className="text-red-500 text-xs mt-1">
                                                    Available stock for this batch: {batchStock.get(`${selectedProduct.name.trim().toLowerCase()}_${itemDetails.batch.trim().toLowerCase()}_${itemDetails.expiry.trim().toLowerCase()}`) || 0}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label htmlFor="pricePerPack" className="block text-sm font-medium text-gray-700 mb-1">
                                                Price per Pack (₹)
                                            </label>
                                            <input
                                                type="number"
                                                id="pricePerPack"
                                                name="pricePerPack"
                                                value={itemDetails.pricePerPack}
                                                onChange={handleItemDetailsChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                                min="0"
                                                step="0.01"
                                                readOnly={!selectedProduct}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="discount" className="block text-sm font-medium text-gray-700 mb-1">
                                                Discount (%)
                                            </label>
                                            <input
                                                type="number"
                                                id="discount"
                                                name="discount"
                                                value={itemDetails.discount}
                                                onChange={handleItemDetailsChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                readOnly={!selectedProduct}
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
                                        disabled={!selectedProduct || !itemDetails.quantitySold || Number(itemDetails.quantitySold) <= 0 || Number(itemDetails.quantitySold) > (batchStock.get(`${selectedProduct.name.trim().toLowerCase()}_${itemDetails.batch.trim().toLowerCase()}_${itemDetails.expiry.trim().toLowerCase()}`) || 0)}
                                    >
                                        <Plus className="mr-2 h-4 w-4" /> Add Item
                                    </Button>
                                </div>

                                {/* Items in Current Bill */}
                                <div className="mb-6">
                                    <h4 className="text-lg font-semibold text-gray-700 mb-3">Bill Items ({newBill.items.length})</h4>
                                    {newBill.items.length > 0 ? (
                                        <div className="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                                                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                                                        <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                                        <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price/Item</th>
                                                        <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Disc (%)</th>
                                                        <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                                        <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {newBill.items.map((item, index) => (
                                                        <tr key={index}>
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{item.product}</td>
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{item.batch}</td>
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{item.expiry}</td>
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-right">{item.quantitySold}</td>
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-right">₹{Number(item.pricePerItem).toFixed(2)}</td>
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-right">{Number(item.discount).toFixed(2)}</td>
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-right">₹{Number(item.totalItemAmount).toFixed(2)}</td>
                                                            <td className="px-4 py-2 whitespace-nowrap text-center text-sm font-medium">
                                                                <Button
                                                                    type="button"
                                                                    onClick={() => handleRemoveItem(index)}
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-red-600 hover:text-red-900 p-1"
                                                                    title="Remove Item"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    <tr>
                                                        <td colSpan="6" className="px-4 py-2 text-right font-bold text-gray-900">Total Bill Amount:</td>
                                                        <td className="px-4 py-2 text-right font-bold text-gray-900">₹{Number(newBill.totalAmount).toFixed(2)}</td>
                                                        <td></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 text-center py-4">No items added to the bill yet.</p>
                                    )}
                                </div>

                                <div className="flex justify-end space-x-3 mt-6">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => { setIsBillModalOpen(false); setIsEditModalOpen(false); resetForm(); }}
                                        className="px-6 py-2"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="inline-flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                        <Save className="mr-2 h-4 w-4" /> {editingBillId ? 'Update Bill' : 'Save Bill'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Product Selection Modal (Controlled by isProductModalOpen) */}
                {isProductModalOpen && (
                    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center p-4 z-50 fade-in-backdrop">
                        <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform scale-95 opacity-0 animate-scale-in">
                            <div className="flex justify-between items-center mb-6 border-b pb-4">
                                <h3 className="text-2xl font-bold text-gray-800">Select Product</h3>
                                <Button
                                    onClick={() => setIsProductModalOpen(false)}
                                    variant="ghost"
                                    size="icon"
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    <X className="h-6 w-6" />
                                </Button>
                            </div>
                            <div className="mb-4">
                                <input
                                    type="text"
                                    placeholder="Search products..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    onChange={(e) => {
                                        const searchTerm = e.target.value.toLowerCase();
                                        // This will filter products from the full list (using loadProductsFromLocalStorage to get original)
                                        // A better approach for search in a modal might be to filter a copy of `products` state
                                        // without affecting the main `products` state, or debounce the search.
                                        // For now, re-load and filter is simple but might be inefficient for very large lists.
                                        const allProducts = loadProductsFromLocalStorage(); // Get fresh list
                                        const filtered = allProducts.filter(p =>
                                            p.name.toLowerCase().includes(searchTerm) ||
                                            p.category.toLowerCase().includes(searchTerm) ||
                                            p.company.toLowerCase().includes(searchTerm)
                                        );
                                        setProducts(filtered); // Temporarily update visible product list in modal
                                    }}
                                />
                            </div>
                            <div className="overflow-y-auto max-h-96 border border-gray-200 rounded-md">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MRP</th>
                                            <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {products.length > 0 ? (
                                            products.map((product) => (
                                                <tr key={product.id} className="hover:bg-gray-50 cursor-pointer">
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{product.quantity} {product.unit}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">₹{Number(product.mrp).toFixed(2)}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-center">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleProductSelection(product.id)}
                                                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-xs"
                                                        >
                                                            Select
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="4" className="px-4 py-4 text-center text-sm text-gray-500">No products found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}


                {/* View Bill Modal (Controlled by isViewModalOpen) */}
                {isViewModalOpen && viewingBill && (
                    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center p-4 z-50 fade-in-backdrop">
                        <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto transform scale-95 opacity-0 animate-scale-in" ref={billRef}>
                            <div className="flex justify-between items-center mb-6 border-b pb-4">
                                <h3 className="text-2xl font-bold text-gray-800">Sales Bill Details</h3>
                                <Button
                                    onClick={() => { setViewingBill(null); setIsViewModalOpen(false); }}
                                    variant="ghost"
                                    size="icon"
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    <X className="h-6 w-6" />
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Bill Number:</p>
                                    <p className="text-lg font-semibold text-gray-900">{viewingBill.billNumber}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Date:</p>
                                    <p className="text-lg font-semibold text-gray-900">{viewingBill.date}</p>
                                </div>
                                <div className="md:col-span-2">
                                    <p className="text-sm font-medium text-gray-700">Customer Name:</p>
                                    <p className="text-xl font-semibold text-gray-900">{viewingBill.customerName}</p>
                                </div>
                            </div>

                            <h4 className="text-lg font-semibold text-gray-700 mb-3">Items Sold:</h4>
                            <div className="overflow-x-auto border border-gray-200 rounded-md shadow-sm mb-6">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                                            <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                            <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price/Item</th>
                                            <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Disc (%)</th>
                                            <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {viewingBill.items.map((item, index) => (
                                            <tr key={index}>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{item.product}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{item.batch}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{item.expiry}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-right">{item.quantitySold}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-right">₹{Number(item.pricePerItem).toFixed(2)}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-right">{Number(item.discount).toFixed(2)}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-right">₹{Number(item.totalItemAmount).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        <tr>
                                            <td colSpan="6" className="px-4 py-2 text-right font-bold text-gray-900 border-t">Total Bill Amount:</td>
                                            <td className="px-4 py-2 text-right font-bold text-gray-900 border-t">₹{Number(viewingBill.totalAmount).toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end space-x-3 mt-6">
                                <Button
                                    onClick={handlePrintBill}
                                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    <Printer className="mr-2 h-4 w-4" /> Print Bill
                                </Button>
                                <Button
                                    onClick={() => handleSendBill(viewingBill)} // Pass viewingBill explicitly
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                >
                                    <Share2 className="mr-2 h-4 w-4" /> Send Bill
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <style jsx>{`
                .fade-in-backdrop {
                    animation: fadeInBackdrop 0.3s ease-out forwards;
                    opacity: 0;
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
                    opacity: 0;
                }
                @keyframes fadeIn {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}