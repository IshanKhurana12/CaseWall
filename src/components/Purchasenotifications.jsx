import { useEffect, useRef, useState } from "react";
import "../Purchasenotification.css";

// Swap these for real customer data whenever you have an orders/reviews
// collection to pull from — the component only needs { name, city, product, price }.
const NAMES = [
  "Ishan Khurana", "Priya", "Arjun Mehta", "Ananya", "Rohan Sharma",
  "Sneha Kapoor", "Kabir", "Diya Malhotra", "Vivaan Singh", "Meera",
  "Aditya Verma", "Kavya", "Rahul Bansal", "Isha", "Karan Arora",
  "Tanvi Gupta", "Aryan", "Neha Khanna", "Yash", "Riya Kapoor",
  "Siddharth Jain", "Pooja", "Vikram Sethi", "Anjali Sharma",

  "Aarav", "Aadhya Mehta", "Aman", "Aisha Khan", "Akash Verma",
  "Akanksha", "Aniket Sharma", "Aarohi", "Abhishek Malhotra",
  "Aditi Kapoor", "Abhinav", "Ayesha Khan", "Ajay", "Alisha Mehta",
  "Akshay Bhatia", "Amrita", "Ansh", "Amisha Kapoor", "Anmol",
  "Apoorva Sharma", "Arnav", "Arpita Mehta", "Ashish", "Ashna Kapoor",
  "Atul Verma", "Avni", "Ayush Sharma", "Bhavna", "Bharat Singh",
  "Bhavya Trilokia", "Chetan", "Charu Mehta", "Chirag Sharma",
  "Chhavi", "Daksh Kapoor", "Damini", "Dev", "Devika Sharma",
  "Dhruv Mehta", "Diksha", "Dinesh", "Divya Kapoor", "Eshan",
  "Ekta Sharma", "Farhan Khan", "Fatima", "Gaurav Mehta", "Garima",
  "Girish Sharma", "Gayatri", "Harsh", "Harshita Kapoor",
  "Himanshu", "Hina Khan", "Hrithik Sharma", "Ira", "Irfan Khan",
  "Ishita", "Jai Mehta", "Jahnvi", "Jatin Sharma", "Jaya",
  "Kartik Kapoor", "Kajal", "Kunal Mehta", "Komal Sharma",
  "Lakshay", "Lavanya Kapoor", "Manish", "Mansi Sharma",
  "Mayank Mehta", "Mahi", "Mohit", "Muskan Khan", "Nakul Sharma",
  "Nandini", "Naveen Mehta", "Navya Kapoor", "Nikhil", "Nikita Sharma",
  "Nitin", "Nisha", "Om Mehta", "Ojas", "Palak Sharma",
  "Parth", "Pankaj Kapoor", "Payal", "Pranav Mehta", "Pragya",
  "Prateek Sharma", "Preeti", "Raghav", "Rashmi Kapoor", "Raj",
  "Rajni", "Rajat Mehta", "Rani", "Rakesh Sharma", "Reema",
  "Ranveer Singh", "Rhea", "Ravi Mehta", "Ritika", "Rishabh Sharma",
  "Roshni", "Ritvik", "Ruhi Kapoor", "Sachin", "Sakshi Mehta",
  "Sahil Sharma", "Saloni", "Sameer", "Samaira Kapoor", "Samar",
  "Sana Khan", "Sanjay", "Sanya Mehta", "Saransh Sharma", "Shalini",
  "Shiv", "Shivani Kapoor", "Shrey", "Shruti", "Siddhant Mehta",
  "Simran", "Soham Sharma", "Sonali", "Sumit", "Sonam Kapoor",
  "Suraj", "Swati", "Tanish Mehta", "Tanya", "Tarun Sharma",
  "Trisha", "Uday", "Urvi Kapoor", "Varun", "Vaishnavi Mehta",
  "Ved", "Vandana Sharma", "Vikas", "Vidhi", "Vineet Kapoor",
  "Vanshika", "Viraj", "Vriti", "Vishal Sharma", "Yamini",
  "Yuvraj Singh", "Zoya",

  "Abeer", "Aarush Sharma", "Aayush", "Adit Mehta", "Advait",
  "Ahaan Kapoor", "Ahan", "Akarsh Sharma", "Akhil", "Amay",
  "Anay Mehta", "Anirudh Sharma", "Anshul", "Anurag Kapoor",
  "Armaan", "Arvind Mehta", "Atharv Sharma", "Avinash",
  "Bhuvan Kapoor", "Bipin", "Brijesh Sharma", "Darsh", "Darpan Mehta",
  "Deepak", "Deepesh Sharma", "Devansh", "Dhanush Kapoor",
  "Dheeraj", "Dushyant Sharma", "Gagan", "Gautam Mehta",
  "Govind", "Hardeep Singh", "Harshit", "Hemant Sharma",
  "Hitesh", "Inder", "Jagdish Mehta", "Jayesh", "Jeet",
  "Keshav Sharma", "Krish", "Krishna Mehta", "Lakshman",
  "Lalit Sharma", "Lokesh", "Madhav Kapoor", "Manav", "Manoj Mehta",
  "Mukul Sharma", "Naman", "Nikhil Mehta", "Nirav", "Nishant Sharma",
  "Piyush", "Pratham Mehta", "Pratik Sharma", "Pulkit", "Raghav Kapoor",
  "Rajat", "Rishit Sharma", "Rohit", "Rudra Mehta", "Sagar",
  "Samarth Sharma", "Sarthak", "Shashank Kapoor", "Shaurya",
  "Shivam Mehta", "Shlok", "Sourabh Sharma", "Srinivas",
  "Tushar Mehta", "Utkarsh", "Varad Sharma", "Vedant",
  "Vijay Mehta", "Vivek", "Yatin Sharma", "Yashwant", "Zaid Khan",

  "Aanchal", "Aaradhya Sharma", "Aastha", "Abha Mehta", "Ahana",
  "Akshara Kapoor", "Alia", "Alka Sharma", "Amaya", "Ambika Mehta",
  "Ameena", "Amrita Sharma", "Anamika", "Anaya Kapoor", "Anushka",
  "Anvi Sharma", "Aradhana", "Archana Mehta", "Arushi",
  "Ashima Kapoor", "Asmita", "Avisha Sharma", "Bani", "Barkha Mehta",
  "Bharti", "Bhumika Sharma", "Chaitali", "Chandni Kapoor",
  "Deepa", "Deepika Sharma", "Deepti", "Devanshi Mehta", "Dhwani",
  "Disha Kapoor", "Esha", "Falguni Sharma", "Geetika", "Gauri Mehta",
  "Gitanjali", "Harini Sharma", "Harleen", "Heena Kapoor", "Ila",
  "Indira", "Ishani Mehta", "Ishika", "Jhanvi Sharma", "Juhi",
  "Jyoti Kapoor", "Kalyani", "Kamya Mehta", "Kanika", "Karishma",
  "Khushi Sharma", "Kirti", "Kriti Mehta", "Lakshmi", "Lata Sharma",
  "Leena", "Mahima Kapoor", "Malvika", "Manisha Mehta", "Manvi",
  "Manya Sharma", "Maya", "Mitali Kapoor", "Mona", "Monika",
  "Naina Sharma", "Namrata", "Nandita Mehta", "Niharika",
  "Nimisha Kapoor", "Pallavi", "Pari Sharma", "Parul", "Pavitra Mehta",
  "Poonam", "Prachi Sharma", "Pranjal", "Prerna Kapoor",
  "Rachana", "Radhika Mehta", "Ragini", "Rajeshwari Sharma",
  "Raksha", "Rashi Kapoor", "Raveena", "Renuka Mehta", "Renu",
  "Richa Sharma", "Riddhi", "Rimjhim Kapoor", "Rina", "Ritu Mehta",
  "Rupal", "Sakina Khan", "Salma", "Samiksha Mehta", "Samreen",
  "Sandhya Sharma", "Sanjana", "Sapna Kapoor", "Sarika", "Shanaya",
  "Shefali Mehta", "Shikha", "Shilpa Sharma", "Shreya",
  "Shraddha Kapoor", "Shweta", "Sonal Mehta", "Sonika", "Srishti",
  "Supriya Sharma", "Surabhi", "Susmita Kapoor", "Swara", "Tamanna",
  "Tanu", "Tanuja Mehta", "Tara", "Tejaswini Sharma", "Tina",
  "Tulika", "Uma Kapoor", "Upasana", "Vaidehi Mehta", "Vasudha",
  "Vasundhara Sharma", "Veena", "Vidya", "Vijaya Kapoor", "Vini",
  "Yashika Sharma", "Yogita", "Zara Khan", "Zeenat",

  "Abhay", "Adarsh Mehta", "Adil Khan", "Aftab", "Amit Sharma",
  "Amar", "Anant Kapoor", "Ankur", "Ashok Mehta", "Asif Khan",
  "Balram", "Bhaskar Sharma", "Danish", "Darshan Mehta", "Deep",
  "Dhanraj", "Dilip Sharma", "Faizan", "Faisal Khan", "Ganesh",
  "Haris", "Harpreet Singh", "Hassan", "Imran Khan", "Jaspreet",
  "Javed", "Kamal Sharma", "Kashish", "Luv Mehta", "Mandeep Singh",
  "Mihir", "Mohan Sharma", "Mukesh", "Neeraj Mehta", "Niranjan",
  "Pawan", "Pradeep Sharma", "Prakash", "Prem Kapoor", "Rahil",
  "Rajeev Mehta", "Raman", "Ramesh Sharma", "Ranjit", "Ritesh Mehta",
  "Roshan", "Sandeep Sharma", "Saurabh", "Shadab Khan", "Shankar",
  "Shantanu Mehta", "Shekhar", "Sheraz Khan", "Shubham Sharma",
  "Sohail", "Sunny", "Surya Mehta", "Tanmay", "Taran Sharma",
  "Tejas", "Ujjwal", "Vansh Mehta", "Vasu", "Vicky Sharma",
  "Vikrant", "Vinay Mehta", "Vishnu", "Yogesh Sharma",
  "Zubin", "Zeeshan Khan"
];

const CITIES = [
  "Delhi", "Mumbai", "Bengaluru", "Pune", "Hyderabad", "Jaipur",
  "Chennai", "Kolkata", "Ahmedabad", "Chandigarh", "Lucknow", "Indore",
];

const ACTIONS = ["just purchased", "just bought", "just added to cart"];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function minutesAgoLabel() {
  return `${Math.floor(Math.random() * 14) + 1} min ago`;
}

function formatPrice(product) {
  const value = product.priceFrom ?? product.price;
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? `₹${num}` : String(value);
}

/**
 * Floating "social proof" toast that cycles through real products from
 * your catalog with randomized Indian names/cities. Renders nothing
 * until at least one product is available.
 *
 * Usage: <PurchaseNotifications products={products} />
 * `products` should be the same array you already load from Firestore
 * (each item just needs a `name`, plus optional `price`/`priceFrom`).
 */
export default function PurchaseNotifications({ products = [], enabled = true }) {
  const [current, setCurrent] = useState(null);
  const [visible, setVisible] = useState(false);
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    if (!enabled || products.length === 0) return;

    function showOne() {
      const product = randomFrom(products);
      setCurrent({
        name: randomFrom(NAMES),
        city: randomFrom(CITIES),
        action: randomFrom(ACTIONS),
        productName: product.name || "this item",
        price: formatPrice(product),
        ago: minutesAgoLabel(),
        key: Date.now(),
      });
      setVisible(true);

      const hideTimer = setTimeout(() => setVisible(false), 5000);
      const nextTimer = setTimeout(showOne, 18000 + Math.random() * 4000); // ~18-22s between notifications
      timers.current.push(hideTimer, nextTimer);
    }

    const startTimer = setTimeout(showOne, 1200); // first one appears quickly
    timers.current.push(startTimer);

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, products.length]);

  if (!current) return null;

  return (
    <div className="purchase-notif-root" aria-live="polite">
      <div className={"purchase-notif-card" + (visible ? " is-visible" : "")}>
        <button
          type="button"
          className="purchase-notif-close"
          aria-label="Dismiss"
          onClick={() => setVisible(false)}
        >
          &times;
        </button>
        <div className="purchase-notif-avatar">{current.name.charAt(0)}</div>
        <div className="purchase-notif-body">
          <div className="purchase-notif-line">
            <strong>{current.name}</strong> from {current.city} {current.action}{" "}
            <span className="purchase-notif-product">{current.productName}</span>
            {current.price && <span className="purchase-notif-price"> · {current.price}</span>}
          </div>
          <div className="purchase-notif-meta">
            <span className="purchase-notif-verified">&#10003; Verified order</span>
            <span>&middot;</span>
            <span>{current.ago}</span>
          </div>
        </div>
      </div>
    </div>
  );
}