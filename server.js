const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// MongoDB ulanish
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://refbot:refbot00@gamepaymentbot.ffcsj5v.mongodb.net/learn?retryWrites=true&w=majority');

// Modellar
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstName: String,
    lastName: String,
    avatar: String,
    englishLevel: { type: String, default: 'beginner' },
    age: Number,
    bio: String,
    coins: { type: Number, default: 100 },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    rating: { type: Number, default: 0 }, // Yangi: Reyting
    isPremium: { type: Boolean, default: false },
    isTeacher: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: String,
    coins: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

const CourseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    level: String,
    category: String,
    price: { type: Number, default: 0 },
    image: String,
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lessons: [{
        title: String,
        videoUrl: String,
        content: String,
        materials: [String],
        duration: Number,
        order: Number
    }],
    quizzes: [{
        lessonId: mongoose.Schema.Types.ObjectId,
        questions: [{
            question: String,
            options: [String],
            correctAnswer: Number
        }]
    }],
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [{
        text: { type: String, required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        replies: [{
            text: { type: String, required: true },
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            createdAt: { type: Date, default: Date.now },
            likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
        }]
    }],
    isActive: { type: Boolean, default: true },
    isApproved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const ProgressSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    completedLessons: [{ type: mongoose.Schema.Types.ObjectId }],
    quizResults: [{
        quizId: mongoose.Schema.Types.ObjectId,
        score: Number,
        totalQuestions: Number,
        answers: [Number],
        completedAt: { type: Date, default: Date.now }
    }],
    currentLesson: { type: mongoose.Schema.Types.ObjectId },
    progress: { type: Number, default: 0 },
    lastAccessed: { type: Date, default: Date.now }
});

const PaymentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['course_purchase', 'premium_subscription'], required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Course = mongoose.model('Course', CourseSchema);
const Progress = mongoose.model('Progress', ProgressSchema);
const Payment = mongoose.model('Payment', PaymentSchema);

// Avtomatik Admin Yaratish
async function createDefaultAdmin() {
    try {
        const adminExists = await User.findOne({ email: 'admin@englishmaster.uz' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const adminUser = new User({
                username: 'admin',
                email: 'admin@englishmaster.uz',
                password: hashedPassword,
                firstName: 'System',
                lastName: 'Administrator',
                isAdmin: true,
                isTeacher: true,
                isPremium: true,
                coins: 10000,
                rating: 1000
            });
            await adminUser.save();
            console.log('✅ Avtomatik admin hisobi yaratildi:');
            console.log('📧 Email: admin@englishmaster.uz');
            console.log('🔑 Password: admin123');
            console.log('🔗 Admin panel: http://localhost:3000/admin');
        } else {
            console.log('✅ Admin hisobi allaqachon mavjud');
            console.log('📧 Email: admin@englishmaster.uz');
            console.log('🔗 Admin panel: http://localhost:3000/admin');
        }
    } catch (error) {
        console.error('❌ Admin hisobi yaratishda xato:', error);
    }
}

// Test kurslar yaratish
async function createTestCourses() {
    try {
        const admin = await User.findOne({ email: 'admin@englishmaster.uz' });
        if (!admin) return;
        const testCourses = [
            {
                title: 'Ingliz tili - Boshlang\'ich daraja',
                description: 'Ingliz tilining asoslarini o\'rganing',
                level: 'beginner',
                category: 'General English',
                price: 0,
                image: null,
                teacher: admin._id,
                lessons: [
                    { title: 'Salomlashish', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', content: 'Hello, how are you? This is a basic greeting in English. Practice saying it with friends.', materials: [], duration: 30, order: 0 },
                    { title: 'O\'zini tanishtirish', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', content: 'My name is John. I am from Uzbekistan. What is your name?', materials: [], duration: 45, order: 1 }
                ],
                quizzes: [],
                students: [],
                likes: [],
                comments: [],
                isActive: true,
                isApproved: true
            },
            {
                title: 'Business English - O\'rta daraja',
                description: 'Biznes ingliz tili uchun kurs',
                level: 'intermediate',
                category: 'Business',
                price: 500,
                image: null,
                teacher: admin._id,
                lessons: [
                    { title: 'Email yozish', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', content: 'Formal emails: Dear Sir/Madam, I am writing to inquire about...', materials: [], duration: 60, order: 0 }
                ],
                quizzes: [],
                students: [],
                likes: [],
                comments: [],
                isActive: true,
                isApproved: true
            }
        ];
        for (const courseData of testCourses) {
            const existing = await Course.findOne({ title: courseData.title });
            if (!existing) {
                const course = new Course(courseData);
                await course.save();
                console.log(`✅ Test kurs yaratildi: ${courseData.title}`);
            }
        }
    } catch (error) {
        console.error('Test kurslar yaratishda xato:', error);
    }
}

// Fayl yuklash konfiguratsiyasi
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const upload = multer({ storage: storage });

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Token talab qilinadi' });
    }
    jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_here', (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Yaroqsiz token' });
        }
        req.user = user;
        next();
    });
};

// Admin middleware
const requireAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: 'Admin huquqi talab qilinadi' });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
};

// ==================== ADMIN API ROUTES ====================

// Admin statistikasi
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalTeachers = await User.countDocuments({ isTeacher: true });
        const totalCourses = await Course.countDocuments();
        const totalPremiumUsers = await User.countDocuments({ isPremium: true });
       
        // Oylik daromad
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
       
        const monthlyRevenue = await Payment.aggregate([
            {
                $match: {
                    createdAt: { $gte: startOfMonth },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
       
        // Haftalik daromad
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
       
        const weeklyRevenue = await Payment.aggregate([
            {
                $match: {
                    createdAt: { $gte: startOfWeek },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
       
        // Kurslar statistikasi
        const coursesStats = await Course.aggregate([
            {
                $group: {
                    _id: '$level',
                    count: { $sum: 1 },
                    avgStudents: { $avg: { $size: '$students' } }
                }
            }
        ]);

        res.json({
            totalUsers,
            totalTeachers,
            totalCourses,
            totalPremiumUsers,
            monthlyRevenue: monthlyRevenue[0]?.total || 0,
            weeklyRevenue: weeklyRevenue[0]?.total || 0,
            coursesStats
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Daromad statistikasi
app.get('/api/admin/revenue', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { period = 'monthly' } = req.query;
       
        let groupFormat;
        let dateFilter = {};
       
        switch (period) {
            case 'daily':
                groupFormat = { 
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                };
                dateFilter = { 
                    createdAt: { 
                        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
                    } 
                };
                break;
            case 'weekly':
                groupFormat = { 
                    year: { $year: '$createdAt' },
                    week: { $week: '$createdAt' }
                };
                dateFilter = { 
                    createdAt: { 
                        $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) 
                    } 
                };
                break;
            case 'monthly':
            default:
                groupFormat = { 
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                };
                dateFilter = { 
                    createdAt: { 
                        $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) 
                    } 
                };
                break;
            case 'yearly':
                groupFormat = { 
                    year: { $year: '$createdAt' }
                };
                dateFilter = {};
                break;
        }

        const revenueStats = await Payment.aggregate([
            {
                $match: {
                    ...dateFilter,
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: groupFormat,
                    totalRevenue: { $sum: '$amount' },
                    transactionCount: { $sum: 1 },
                    coursePurchases: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'course_purchase'] }, 1, 0]
                        }
                    },
                    premiumSubscriptions: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'premium_subscription'] }, 1, 0]
                        }
                    }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1, '_id.day': 1 }
            }
        ]);

        res.json(revenueStats);
    } catch (error) {
        console.error('Revenue stats error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Bitta foydalanuvchini olish (tahrirlash uchun)
app.get('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });
        }
        res.json({ user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Barcha foydalanuvchilar
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const skip = (page - 1) * limit;
       
        const filter = search ? {
            $or: [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } }
            ]
        } : {};
       
        const users = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
           
        const total = await User.countDocuments(filter);
       
        res.json({
            users,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Foydalanuvchini yangilash
app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, englishLevel, age, bio, coins, isPremium, isTeacher, isAdmin, isActive } = req.body;
       
        const user = await User.findByIdAndUpdate(
            id,
            {
                firstName,
                lastName,
                englishLevel,
                age,
                bio,
                coins,
                isPremium,
                isTeacher,
                isAdmin,
                isActive
            },
            { new: true }
        ).select('-password');
       
        if (!user) {
            return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });
        }
       
        res.json({
            message: 'Foydalanuvchi muvaffaqiyatli yangilandi',
            user
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Foydalanuvchini o'chirish
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
       
        // Foydalanuvchi kurslarini tekshirish
        const userCourses = await Course.countDocuments({ teacher: id });
        if (userCourses > 0) {
            return res.status(400).json({ 
                message: 'Foydalanuvchining kurslari mavjud. Avval kurslarni o\'chiring.' 
            });
        }
       
        await User.findByIdAndDelete(id);
        await Progress.deleteMany({ user: id });
        await Payment.deleteMany({ user: id });
       
        res.json({ message: 'Foydalanuvchi muvaffaqiyatli o\'chirildi' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Bitta kursni olish (tahrirlash uchun)
app.get('/api/admin/courses/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const course = await Course.findById(id).populate('teacher', 'firstName lastName email');
        if (!course) {
            return res.status(404).json({ message: 'Kurs topilmadi' });
        }
        res.json({ course });
    } catch (error) {
        console.error('Get course error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Barcha kurslar (admin uchun)
app.get('/api/admin/courses', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', status = 'all' } = req.query;
        const skip = (page - 1) * limit;
       
        let filter = search ? {
            $or: [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ]
        } : {};
       
        if (status === 'approved') {
            filter.isApproved = true;
        } else if (status === 'pending') {
            filter.isApproved = false;
        } else if (status === 'active') {
            filter.isActive = true;
        } else if (status === 'inactive') {
            filter.isActive = false;
        }
       
        const courses = await Course.find(filter)
            .populate('teacher', 'firstName lastName email')
            .populate('students', 'firstName lastName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
           
        const total = await Course.countDocuments(filter);
       
        res.json({
            courses,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        console.error('Admin courses error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Kursni yangilash
app.put('/api/admin/courses/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, level, category, price, isActive, isApproved } = req.body;
       
        const course = await Course.findByIdAndUpdate(
            id,
            {
                title,
                description,
                level,
                category,
                price: parseFloat(price),
                isActive,
                isApproved
            },
            { new: true }
        ).populate('teacher', 'firstName lastName email');
       
        if (!course) {
            return res.status(404).json({ message: 'Kurs topilmadi' });
        }
       
        res.json({
            message: 'Kurs muvaffaqiyatli yangilandi',
            course
        });
    } catch (error) {
        console.error('Update course error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Kursni o'chirish
app.delete('/api/admin/courses/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
       
        await Course.findByIdAndDelete(id);
        await Progress.deleteMany({ course: id });
        await Payment.deleteMany({ course: id });
       
        res.json({ message: 'Kurs muvaffaqiyatli o\'chirildi' });
    } catch (error) {
        console.error('Delete course error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Kursni tasdiqlash/rad etish
app.post('/api/admin/courses/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { approved } = req.body;
       
        const course = await Course.findByIdAndUpdate(
            id,
            { isApproved: approved },
            { new: true }
        ).populate('teacher', 'firstName lastName email');
       
        if (!course) {
            return res.status(404).json({ message: 'Kurs topilmadi' });
        }
       
        res.json({
            message: `Kurs ${approved ? 'tasdiqlandi' : 'rad etildi'}`,
            course
        });
    } catch (error) {
        console.error('Approve course error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Premium obunalarni boshqarish
app.get('/api/admin/premium-subscriptions', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;
       
        const subscriptions = await Payment.find({ type: 'premium_subscription' })
            .populate('user', 'firstName lastName email username')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
           
        const total = await Payment.countDocuments({ type: 'premium_subscription' });
       
        res.json({
            subscriptions,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        console.error('Premium subscriptions error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// To'lovlar tarixi
app.get('/api/admin/payments', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, type } = req.query;
        const skip = (page - 1) * limit;
       
        let filter = {};
        if (type) {
            filter.type = type;
        }
       
        const payments = await Payment.find(filter)
            .populate('user', 'firstName lastName email')
            .populate('course', 'title')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
           
        const total = await Payment.countDocuments(filter);
       
        res.json({
            payments,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        console.error('Payments error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Kurs ishtirokchilari
app.get('/api/admin/courses/:id/participants', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;
       
        const course = await Course.findById(id).populate({
            path: 'students',
            select: 'firstName lastName email avatar englishLevel createdAt',
            options: {
                skip: skip,
                limit: parseInt(limit)
            }
        });
       
        if (!course) {
            return res.status(404).json({ message: 'Kurs topilmadi' });
        }
       
        const total = course.students.length;
       
        // Progress ma'lumotlari
        const progressData = await Progress.find({ 
            course: id,
            user: { $in: course.students.map(s => s._id) }
        });
       
        const participants = course.students.map(student => {
            const progress = progressData.find(p => p.user.toString() === student._id.toString());
            return {
                ...student.toObject(),
                progress: progress ? progress.progress : 0,
                completedLessons: progress ? progress.completedLessons.length : 0,
                lastAccessed: progress ? progress.lastAccessed : null
            };
        });
       
        res.json({
            participants,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total,
            course: {
                title: course.title,
                totalLessons: course.lessons.length
            }
        });
    } catch (error) {
        console.error('Course participants error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// ==================== MAVJUD API ROUTES ====================

// Ro'yxatdan o'tish
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, firstName, lastName, englishLevel, age, bio } = req.body;
       
        // Foydalanuvchi mavjudligini tekshirish
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });
        if (existingUser) {
            return res.status(400).json({ message: 'Email yoki username band' });
        }
       
        // Parolni hash qilish
        const hashedPassword = await bcrypt.hash(password, 10);
       
        // Yangi foydalanuvchi yaratish
        const user = new User({
            username,
            email,
            password: hashedPassword,
            firstName,
            lastName,
            englishLevel,
            age,
            bio
        });
       
        await user.save();
       
        // Token yaratish
        const token = jwt.sign(
            { userId: user._id }, 
            process.env.JWT_SECRET || 'your_super_secret_jwt_key_here'
        );
       
        res.status(201).json({
            message: 'Foydalanuvchi muvaffaqiyatli yaratildi',
            token,
            user: {
                id: user._id,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                englishLevel: user.englishLevel,
                coins: user.coins,
                isPremium: user.isPremium,
                isTeacher: user.isTeacher,
                isAdmin: user.isAdmin
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Kirish
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
       
        // Foydalanuvchini topish
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Foydalanuvchi topilmadi' });
        }
       
        // Parolni tekshirish
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Noto\'g\'ri parol' });
        }
       
        // Token yaratish
        const token = jwt.sign(
            { userId: user._id }, 
            process.env.JWT_SECRET || 'your_super_secret_jwt_key_here'
        );
       
        res.json({
            message: 'Muvaffaqiyatli kirish',
            token,
            user: {
                id: user._id,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                englishLevel: user.englishLevel,
                coins: user.coins,
                isPremium: user.isPremium,
                isTeacher: user.isTeacher,
                isAdmin: user.isAdmin
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Profilga yuklashda include parametrlari uchun /api/profile ni yangilang
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { include } = req.query;
        let query = User.findById(req.user.userId).select('-password').populate('friends', 'firstName lastName avatar');
        const user = await query;
        if (!user) {
            return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });
        }
        // Reytingni hisoblash (progress asosida)
        const progress = await Progress.find({ user: req.user.userId });
        const rating = Math.floor(progress.reduce((sum, p) => sum + p.progress, 0) / Math.max(progress.length, 1)) + Math.floor(Math.random() * 100);
        user.rating = rating;
        await user.save();
        let data = user;  // O'zgartirildi: { user } emas, to'g'ridan-to'g'ri user
        if (include && include.includes('progress')) {
            data.progress = await Progress.find({ user: req.user.userId }).populate('course', 'title image level');
        }
        if (include && include.includes('rating')) {
            data.rating = rating;
        }
        if (include && include.includes('allUsers')) {
            data.allUsers = await User.find({}).select('firstName lastName avatar rating englishLevel').limit(50);
        }
        res.json(data);
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Profilni yangilash
app.put('/api/profile', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        const { firstName, lastName, englishLevel, age, bio } = req.body;
       
        const updateData = {
            firstName,
            lastName,
            englishLevel,
            age,
            bio
        };
       
        // Agar avatar yuklangan bo'lsa
        if (req.file) {
            updateData.avatar = req.file.filename;
        }
       
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            updateData,
            { new: true }
        ).select('-password');
       
        res.json({ 
            message: 'Profil muvaffaqiyatli yangilandi',
            user
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Barcha kurslar
app.get('/api/courses', async (req, res) => {
    try {
        const courses = await Course.find({ isActive: true, isApproved: true })
            .populate('teacher', 'firstName lastName avatar')
            .select('-lessons -quizzes');
        res.json(courses);
    } catch (error) {
        console.error('Courses error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Kurs ma'lumotlari
app.get('/api/courses/:id', async (req, res) => {
    try {
        const { include } = req.query;
        let query = Course.findById(req.params.id)
            .populate('teacher', 'firstName lastName avatar bio')
            .populate('students', 'firstName lastName avatar');

        if (include && include.includes('likes')) {
            query = query.populate('likes', 'firstName lastName avatar');
        }

        if (include && include.includes('comments')) {
            query = query
                .populate('comments.user', 'firstName lastName avatar')
                .populate('comments.likes', 'firstName lastName avatar')
                .populate('comments.replies.user', 'firstName lastName avatar')
                .populate('comments.replies.likes', 'firstName lastName avatar');
        }

        const course = await query;

        if (!course) {
            return res.status(404).json({ message: 'Kurs topilmadi' });
        }
        
        res.json(course);
    } catch (error) {
        console.error('Course detail error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Kurs like toggle
app.post('/api/courses/:id/like', authenticateToken, async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ message: 'Kurs topilmadi' });
        }

        const userId = req.user.userId;
        const likeIndex = course.likes.findIndex(like => like.toString() === userId);

        if (likeIndex > -1) {
            course.likes.splice(likeIndex, 1);
        } else {
            course.likes.push(userId);
        }

        await course.save();

        const updatedCourse = await Course.findById(req.params.id).populate('likes', 'firstName lastName avatar');

        res.json({
            message: 'Like muvaffaqiyatli yangilandi',
            likes: updatedCourse.likes
        });
    } catch (error) {
        console.error('Like error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Comment qo'shish yoki reply
app.post('/api/courses/:id/comments', authenticateToken, async (req, res) => {
    try {
        const { text, replyTo } = req.body;
        if (!text || text.trim().length < 1) {
            return res.status(400).json({ message: 'Izoh bo\'sh bo\'lmasligi kerak' });
        }

        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ message: 'Kurs topilmadi' });
        }

        const userId = req.user.userId;

        if (replyTo) {
            // Reply topish
            const commentIndex = course.comments.findIndex(c => c._id.toString() === replyTo);
            if (commentIndex === -1) {
                return res.status(404).json({ message: 'Comment topilmadi' });
            }

            course.comments[commentIndex].replies.push({
                text: text.trim(),
                user: userId
            });
        } else {
            // Yangi comment
            course.comments.push({
                text: text.trim(),
                user: userId
            });
        }

        await course.save();

        const updatedCourse = await Course.findById(req.params.id)
            .populate('comments.user', 'firstName lastName avatar')
            .populate('comments.likes', 'firstName lastName avatar')
            .populate('comments.replies.user', 'firstName lastName avatar')
            .populate('comments.replies.likes', 'firstName lastName avatar');

        res.json({
            message: 'Comment muvaffaqiyatli qo\'shildi',
            comments: updatedCourse.comments
        });
    } catch (error) {
        console.error('Comment error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Comment like toggle
app.post('/api/courses/:id/comments/:commentId/like', authenticateToken, async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ message: 'Kurs topilmadi' });
        }

        const commentId = req.params.commentId;
        const commentIndex = course.comments.findIndex(c => c._id.toString() === commentId);
        if (commentIndex === -1) {
            return res.status(404).json({ message: 'Comment topilmadi' });
        }

        const userId = req.user.userId;
        const likeIndex = course.comments[commentIndex].likes.findIndex(like => like.toString() === userId);

        if (likeIndex > -1) {
            course.comments[commentIndex].likes.splice(likeIndex, 1);
        } else {
            course.comments[commentIndex].likes.push(userId);
        }

        await course.save();

        const updatedCourse = await Course.findById(req.params.id)
            .populate('comments.user', 'firstName lastName avatar')
            .populate('comments.likes', 'firstName lastName avatar')
            .populate('comments.replies.user', 'firstName lastName avatar')
            .populate('comments.replies.likes', 'firstName lastName avatar');

        res.json({
            message: 'Comment like muvaffaqiyatli yangilandi',
            comment: updatedCourse.comments[commentIndex]
        });
    } catch (error) {
        console.error('Comment like error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Kursga yozilish
app.post('/api/courses/:id/enroll', authenticateToken, async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.user.userId;
       
        // Kursni topish
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: 'Kurs topilmadi' });
        }
       
        // Pullik kurs uchun to'lov tekshirish
        if (course.price > 0) {
            const user = await User.findById(userId);
            if (user.coins < course.price) {
                return res.status(400).json({ 
                    message: 'Yetarli coin mavjud emas', 
                    required: course.price,
                    current: user.coins 
                });
            }
           
            // Coinlarni ayirish
            user.coins -= course.price;
            await user.save();
           
            // To'lov yozuvini yaratish
            const payment = new Payment({
                user: userId,
                course: courseId,
                amount: course.price,
                type: 'course_purchase',
                status: 'completed'
            });
            await payment.save();
        }
       
        // Kursga o'quvchini qo'shish
        if (!course.students.includes(userId)) {
            course.students.push(userId);
            await course.save();
        }
       
        // Progress yaratish
        let progress = await Progress.findOne({
            user: userId,
            course: courseId
        });
       
        if (!progress) {
            progress = new Progress({
                user: userId,
                course: courseId,
                currentLesson: course.lessons[0]?._id
            });
            await progress.save();
        }
       
        res.json({ 
            message: 'Kursga muvaffaqiyatli qo\'shildingiz',
            progress
        });
    } catch (error) {
        console.error('Enroll error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Darsni boshlash
app.get('/api/courses/:courseId/lessons/:lessonId', authenticateToken, async (req, res) => {
    try {
        const { courseId, lessonId } = req.params;
        const userId = req.user.userId;
       
        // Progressni tekshirish
        const progress = await Progress.findOne({
            user: userId,
            course: courseId
        });
       
        if (!progress) {
            return res.status(403).json({ message: 'Siz bu kursga yozilmagansiz' });
        }
       
        // Kurs va darsni topish
        const course = await Course.findById(courseId);
        const lesson = course.lessons.id(lessonId);
       
        if (!lesson) {
            return res.status(404).json({ message: 'Dars topilmadi' });
        }
       
        // Progressni yangilash
        progress.currentLesson = lessonId;
        progress.lastAccessed = new Date();
        await progress.save();
       
        res.json({
            lesson,
            course: {
                title: course.title,
                teacher: course.teacher
            }
        });
    } catch (error) {
        console.error('Lesson error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Darsni tugatish
app.post('/api/courses/:courseId/lessons/:lessonId/complete', authenticateToken, async (req, res) => {
    try {
        const { courseId, lessonId } = req.params;
        const userId = req.user.userId;
       
        // Progressni topish
        const progress = await Progress.findOne({
            user: userId,
            course: courseId
        });
       
        if (!progress) {
            return res.status(403).json({ message: 'Progress topilmadi' });
        }
       
        // Agar dars avval tugatilmagan bo'lsa
        if (!progress.completedLessons.includes(lessonId)) {
            progress.completedLessons.push(lessonId);
           
            // Progress foizini hisoblash
            const course = await Course.findById(courseId);
            const totalLessons = course.lessons.length;
            progress.progress = Math.round((progress.completedLessons.length / totalLessons) * 100);
           
            // Coin berish
            const user = await User.findById(userId);
            user.coins += 10; // Har bir dars uchun 10 coin
            await user.save();
           
            await progress.save();
        }
       
        res.json({ 
            message: 'Dars muvaffaqiyatli tugatildi',
            coinsAdded: 10,
            progress: progress.progress
        });
    } catch (error) {
        console.error('Complete lesson error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Test natijasini saqlash
app.post('/api/courses/:courseId/quizzes/:quizId/submit', authenticateToken, async (req, res) => {
    try {
        const { courseId, quizId } = req.params;
        const { answers } = req.body;
        const userId = req.user.userId;
       
        // Kurs va testni topish
        const course = await Course.findById(courseId);
        const quiz = course.quizzes.id(quizId);
       
        if (!quiz) {
            return res.status(404).json({ message: 'Test topilmadi' });
        }
       
        // Ballarni hisoblash
        let score = 0;
        quiz.questions.forEach((question, index) => {
            if (answers[index] === question.correctAnswer) {
                score++;
            }
        });
       
        // Progressni yangilash
        const progress = await Progress.findOne({
            user: userId,
            course: courseId
        });
       
        if (progress) {
            // Eski natijani o'chirish
            progress.quizResults = progress.quizResults.filter(
                result => result.quizId.toString() !== quizId
            );
           
            // Yangi natijani qo'shish
            progress.quizResults.push({
                quizId,
                score,
                totalQuestions: quiz.questions.length,
                answers,
                completedAt: new Date()
            });
           
            await progress.save();
        }
       
        // Agar test muvaffaqiyatli topshirilgan bo'lsa, coin berish
        const successRate = score / quiz.questions.length;
        let coinsEarned = 0;
       
        if (successRate >= 0.8) {
            coinsEarned = 50; // 80% dan yuqori bo'lsa 50 coin
        } else if (successRate >= 0.6) {
            coinsEarned = 30; // 60% dan yuqori bo'lsa 30 coin
        }
       
        if (coinsEarned > 0) {
            const user = await User.findById(userId);
            user.coins += coinsEarned;
            await user.save();
        }
       
        res.json({
            score,
            totalQuestions: quiz.questions.length,
            successRate: Math.round(successRate * 100),
            coinsEarned,
            passed: successRate >= 0.6
        });
    } catch (error) {
        console.error('Quiz submit error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// O'qituvchi kurslari
app.get('/api/teacher/courses', authenticateToken, async (req, res) => {
    try {
        const courses = await Course.find({ teacher: req.user.userId })
            .populate('students', 'firstName lastName avatar')
            .sort({ createdAt: -1 });
       
        res.json(courses);
    } catch (error) {
        console.error('Teacher courses error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Yangi kurs yaratish
app.post('/api/courses', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { title, description, level, category, price, lessons } = req.body;
       
        const courseData = {
            title,
            description,
            level,
            category,
            price: parseInt(price),
            teacher: req.user.userId,
            likes: [],
            comments: [],
            isApproved: false // Yangi kurs admin tomonidan tasdiqlanishi kerak
        };
       
        // Rasm yuklangan bo'lsa
        if (req.file) {
            courseData.image = req.file.filename;
        }
       
        // Darslarni parse qilish
        if (lessons) {
            courseData.lessons = JSON.parse(lessons).map((lesson, index) => ({
                ...lesson,
                order: index
            }));
        }
       
        const course = new Course(courseData);
        await course.save();
       
        res.status(201).json({
            message: 'Kurs muvaffaqiyatli yaratildi. Admin tasdiqlashini kuting.',
            course
        });
    } catch (error) {
        console.error('Create course error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Premium obuna
app.post('/api/premium/subscribe', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
       
        if (user.isPremium) {
            return res.status(400).json({ message: 'Siz allaqachon premium obunasiz' });
        }
       
        if (user.coins < 1200) {
            return res.status(400).json({ 
                message: 'Premium obuna uchun yetarli coin mavjud emas',
                required: 1200,
                current: user.coins
            });
        }
       
        // Coinlarni ayirish va premium obunani faollashtirish
        user.coins -= 1200;
        user.isPremium = true;
        await user.save();
       
        // To'lov yozuvini yaratish
        const payment = new Payment({
            user: user._id,
            amount: 1200,
            type: 'premium_subscription',
            status: 'completed'
        });
        await payment.save();
       
        res.json({ 
            message: 'Premium obuna muvaffaqiyatli faollashtirildi',
            user: {
                coins: user.coins,
                isPremium: user.isPremium
            }
        });
    } catch (error) {
        console.error('Premium subscribe error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Progress GET
app.get('/api/progress', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.query;
        const filter = userId ? { user: userId } : { user: req.user.userId };
        const progress = await Progress.find(filter)
            .populate('course', 'title image level')
            .populate('completedLessons')
            .sort({ lastAccessed: -1 });
        res.json(progress);
    } catch (error) {
        console.error('Progress error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// AI Writing tekshirish (simulyatsiya)
app.post('/api/ai/writing-check', authenticateToken, async (req, res) => {
    try {
        const { text } = req.body;
       
        // Grammatik xatolarni topish (simulyatsiya)
        const grammarMistakes = [
            { mistake: "I is", correction: "I am", explanation: "To'g'ri fe'l shakli" },
            { mistake: "they was", correction: "they were", explanation: "Ko'plikda 'was' emas 'were' ishlatiladi" }
        ].filter(item => text.includes(item.mistake));
       
        // Takliflar
        const suggestions = [
            "Matningizni yanada ravon qilish uchun qo'shimcha gap qo'shishingiz mumkin",
            "Ba'zi so'zlarni sinonimlari bilan almashtirish yaxshi bo'ladi"
        ];
       
        // Umumiy baho
        const score = Math.max(1, 10 - grammarMistakes.length * 2);
       
        res.json({
            grammarMistakes,
            suggestions,
            score,
            overallFeedback: `Sizning writing darajangiz: ${score}/10. ${grammarMistakes.length} ta grammatik xato topildi.`
        });
    } catch (error) {
        console.error('AI writing check error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Yangi Ta'lim API'lari
app.get('/api/flashcards', authenticateToken, async (req, res) => {
    const flashcards = [
        { english: 'Hello', uzbek: 'Salom', example: 'Hello, how are you?' },
        { english: 'Name', uzbek: 'Ism', example: 'What is your name?' },
        { english: 'From', uzbek: 'Dan', example: 'I am from Uzbekistan' },
        { english: 'What', uzbek: 'Nima', example: 'What do you like?' },
        { english: 'Dear', uzbek: 'Hurmatli', example: 'Dear Sir' }
    ];
    const randomCards = flashcards.sort(() => Math.random() - 0.5).slice(0, 5);
    res.json(randomCards);
});

app.get('/api/grammar-quiz', authenticateToken, async (req, res) => {
    const quiz = {
        questions: [
            { question: 'Choose correct: I ___ happy.', options: ['am', 'is', 'are'], correct: 0 },
            { question: 'Plural of "book"?', options: ['books', 'bookes', 'book'], correct: 0 },
            { question: 'Past tense of "go"?', options: ['goed', 'went', 'go'], correct: 1 },
            { question: 'Article for "apple"?', options: ['a', 'an', 'the'], correct: 1 },
            { question: 'Correct: She ___ to school.', options: ['go', 'goes', 'going'], correct: 1 }
        ]
    };
    res.json(quiz);
});

app.get('/api/daily-challenge', authenticateToken, async (req, res) => {
    const challenges = [
        { tip: 'Bugun 10 ta yangi so\'z o\'rganing: apple, banana, cat...', challenge: 'Yozing: My favorite fruit is...' },
        { tip: 'Grammatika: Use "a/an" correctly.', challenge: 'Jumla tuzing.' }
    ];
    const random = challenges[Math.floor(Math.random() * challenges.length)];
    res.json(random);
});

// Boshqa user profilini olish
app.get('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select('-password').populate('friends', 'firstName lastName avatar');
        if (!user) {
            return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });
        }
        // Reyting hisoblash
        const progress = await Progress.find({ user: id });
        user.rating = Math.floor(progress.reduce((sum, p) => sum + p.progress, 0) / Math.max(progress.length, 1));
        res.json(user);  // O'zgartirildi: { user } emas, to'g'ridan-to'g'ri user
    } catch (error) {
        console.error('User error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Barcha userlarni olish (qidirish uchun)
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const { search } = req.query;
        let filter = {};
        if (search) {
            filter = {
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } }
                ]
            };
        }
        const users = await User.find(filter).select('firstName lastName avatar rating englishLevel').limit(20);
        res.json(users);
    } catch (error) {
        console.error('Users error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Do'st qo'shish
app.post('/api/friends', authenticateToken, async (req, res) => {
    try {
        const { friendId } = req.body;
        const userId = req.user.userId;
        const user = await User.findById(userId);
        const friend = await User.findById(friendId);
        if (!friend) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });
        if (user.friends.includes(friendId)) return res.status(400).json({ message: 'Allaqachon do\'stsiz' });
        user.friends.push(friendId);
        friend.friends.push(userId);
        await user.save();
        await friend.save();
        res.json({ message: 'Do\'st qo\'shildi' });
    } catch (error) {
        console.error('Friends error:', error);
        res.status(500).json({ message: 'Server xatosi' });
    }
});

// Do'st o'chirish
app.delete('/api/friends/:friendId', authenticateToken, async (req, res) => {
    try {
        const { friendId } = req.params;
        const userId = req.user.userId;
        const user = await User.findById(userId);
        const friend = await User.findById(friendId);
        user.friends = user.friends.filter(id => id.toString() !== friendId);
        friend.friends = friend.friends.filter(id => id.toString() !== userId);
        await user.save();
        await friend.save();
        res.json({ message: 'Do\'st o\'chirildi' });
    } catch (error) {
        console.error('Friends delete error:', error);
        res.status(500).json({ message: 'Server xatosi' });
    }
});

// Do'stlarni olish
app.get('/api/friends', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId).populate('friends', 'firstName lastName avatar');
        res.json(user.friends);
    } catch (error) {
        console.error('Friends get error:', error);
        res.status(500).json({ message: 'Server xatosi' });
    }
});

// Solishtirish API
app.get('/api/compare/:compareId', authenticateToken, async (req, res) => {
    try {
        const { compareId } = req.params;
        const userId = req.user.userId;
        const currentProgress = await Progress.find({ user: userId });
        const compareProgress = await Progress.find({ user: compareId });
        const currentUser = await User.findById(userId).select('rating firstName lastName');
        const compareUser = await User.findById(compareId).select('rating firstName lastName');
        const currentStats = {
            completedCourses: currentProgress.filter(p => p.progress === 100).length,
            completedLessons: currentProgress.reduce((total, p) => total + (p.completedLessons?.length || 0), 0),
            rating: currentUser.rating || 0
        };
        const compareStats = {
            completedCourses: compareProgress.filter(p => p.progress === 100).length,
            completedLessons: compareProgress.reduce((total, p) => total + (p.completedLessons?.length || 0), 0),
            rating: compareUser.rating || 0
        };
        res.json({
            current: { ...currentStats, firstName: currentUser.firstName, lastName: currentUser.lastName },
            compare: { ...compareStats, firstName: compareUser.firstName, lastName: compareUser.lastName }
        });
    } catch (error) {
        console.error('Compare error:', error);
        res.status(500).json({ message: 'Server xatosi' });
    }
});

// Chat xabarlarni olish
app.get('/api/chat/:userId/messages', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const messages = await Message.find({
            $or: [
                { from: req.user.userId, to: userId },
                { from: userId, to: req.user.userId }
            ]
        }).populate('from to', 'firstName lastName').sort({ createdAt: 1 });
        res.json(messages);
    } catch (error) {
        console.error('Chat messages error:', error);
        res.status(500).json({ message: 'Server xatosi' });
    }
});

// Chat xabar yuborish
app.post('/api/chat/:userId/send', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { text, coins } = req.body;
        const user = await User.findById(req.user.userId);
        if (coins > 0 && user.coins < coins) return res.status(400).json({ message: 'Yetarli coin yo\'q' });
        if (coins > 0) {
            user.coins -= coins;
            await user.save();
            const receiver = await User.findById(userId);
            receiver.coins += coins;
            await receiver.save();
        }
        const message = new Message({
            from: req.user.userId,
            to: userId,
            text,
            coins
        });
        await message.save();
        res.json({ message: 'Yuborildi' });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ message: 'Server xatosi' });
    }
});

// Coin yuborish
app.post('/api/coins/send/:receiverId', authenticateToken, async (req, res) => {
    try {
        const { receiverId } = req.params;
        const { amount } = req.body;
        const sender = await User.findById(req.user.userId);
        const receiver = await User.findById(receiverId);
        if (!receiver) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });
        if (sender.coins < amount) return res.status(400).json({ message: 'Yetarli coin yo\'q' });
        sender.coins -= amount;
        receiver.coins += amount;
        await sender.save();
        await receiver.save();
        res.json({ message: 'Coin yuborildi' });
    } catch (error) {
        console.error('Send coins error:', error);
        res.status(500).json({ message: 'Server xatosi' });
    }
});

// Yutuqlar (simulyatsiya)
app.get('/api/achievements', authenticateToken, async (req, res) => {
    try {
        const achievements = [
            { name: 'Birinchi kursni tugatdi', date: new Date().toLocaleDateString('uz-UZ') },
            { name: '10 ta dars o\'tdi', date: new Date(Date.now() - 86400000).toLocaleDateString('uz-UZ') }
        ];
        res.json(achievements);
    } catch (error) {
        console.error('Achievements error:', error);
        res.status(500).json({ message: 'Server xatosi' });
    }
});

// Bildirishnomalar (simulyatsiya)
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const notifications = [
            { id: '1', message: 'Yangi do\'st so\'rovi', time: new Date().toLocaleTimeString('uz-UZ') },
            { id: '2', message: 'Kursga yangi izoh', time: new Date(Date.now() - 3600000).toLocaleTimeString('uz-UZ') }
        ];
        res.json(notifications);
    } catch (error) {
        console.error('Notifications error:', error);
        res.status(500).json({ message: 'Server xatosi' });
    }
});

// Leaderboard
app.get('/api/leaderboard', authenticateToken, async (req, res) => {
    try {
        const users = await User.find({})
            .select('firstName lastName rating')
            .sort({ rating: -1 })
            .limit(10);
        const leaderboard = users.map((u, idx) => ({
            name: `${u.firstName} ${u.lastName}`,
            rating: u.rating || 0,
            rank: idx + 1
        }));
        res.json(leaderboard);
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ message: 'Server xatosi' });
    }
});

// Recent Activity (simulyatsiya)
app.get('/api/recent', authenticateToken, async (req, res) => {
    try {
        const recent = [
            { action: 'Darsni tugatdi: Salomlashish', time: new Date().toISOString() },
            { action: 'Kursga yozildi: Beginner English', time: new Date(Date.now() - 86400000).toISOString() }
        ];
        res.json(recent);
    } catch (error) {
        console.error('Recent activity error:', error);
        res.status(500).json({ message: 'Server xatosi' });
    }
});

// Yangi ta'lim funksiyalari (simulyatsiya)
app.get('/api/vocabulary-builder', authenticateToken, async (req, res) => {
    const words = [
        { word: 'Apple', meaning: 'Olma', example: 'I eat an apple every day.' },
        { word: 'Book', meaning: 'Kitob', example: 'She reads a book.' },
        { word: 'Run', meaning: 'Yugurmoq', example: 'He runs in the park.' }
    ];
    res.json(words);
});

app.get('/api/reading-practice', authenticateToken, async (req, res) => {
    const reading = {
        text: 'English is a global language. It is spoken by millions of people around the world. Learning English opens many doors.',
        questions: [
            {
                q: 'What is English?',
                options: ['A global language', 'A local language', 'A dead language'],
                correct: 0
            },
            {
                q: 'What does learning English do?',
                options: ['Closes doors', 'Opens doors', 'Nothing'],
                correct: 1
            }
        ]
    };
    res.json(reading);
});

// Static fayllar
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/courses', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'courses.html'));
});

app.get('/course/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'course-detail.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/teacher', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'teacher.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Admin foydalanuvchi yaratish (faqat development uchun)
app.post('/api/admin/create-admin', async (req, res) => {
    try {
        const { email, password } = req.body;
       
        // Parolni hash qilish
        const hashedPassword = await bcrypt.hash(password, 10);
       
        // Admin foydalanuvchi yaratish
        const adminUser = new User({
            username: 'admin',
            email,
            password: hashedPassword,
            firstName: 'Admin',
            lastName: 'User',
            isAdmin: true,
            isTeacher: true,
            isPremium: true
        });
       
        await adminUser.save();
       
        res.json({ message: 'Admin foydalanuvchi muvaffaqiyatli yaratildi' });
    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ message: 'Server xatosi', error: error.message });
    }
});

// Server ishga tushirish
mongoose.connection.once('open', async () => {
    console.log('✅ MongoDB ga muvaffaqiyatli ulandi');
    await createDefaultAdmin();
    await createTestCourses();
});

app.listen(PORT, () => {
    console.log(`Server ${PORT}-portda ishga tushdi`);
    console.log(`http://localhost:${PORT}`);
});