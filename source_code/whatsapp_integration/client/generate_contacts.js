import XLSX from 'xlsx';
import fs from 'fs';

const contacts = [
    { Name: "Niresh", Number: "919345034653" },
    { Name: "Aarav", Number: "919876543210" },
    { Name: "Vivaan", Number: "919876543211" },
    { Name: "Aditya", Number: "919876543212" },
    { Name: "Vihaan", Number: "919876543213" },
    { Name: "Arjun", Number: "919876543214" },
    { Name: "Sai", Number: "919876543215" },
    { Name: "Reyansh", Number: "919876543216" },
    { Name: "Ayan", Number: "919876543217" },
    { Name: "Krishna", Number: "919876543218" }
];

const worksheet = XLSX.utils.json_to_sheet(contacts);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");

XLSX.writeFile(workbook, "contacts.xlsx");
console.log("contacts.xlsx created successfully!");
