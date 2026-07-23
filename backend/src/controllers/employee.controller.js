const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const AVAILABLE_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'FAISAL', 'ORDER_ENTRY', 'OUTLET', 'PRODUCTION',
  'STORE', 'LOGO_DESIGN', 'DISPATCH', 'DELIVERY_BOY', 'INVENTORY_VIEW'
];

const OUTLET_SUB_ROLES = ['POS', 'GENERAL', 'ALL'];

const DEPARTMENT_ROLES = {
  'Order Entry': ['ORDER_ENTRY', 'FAISAL'],
  'Store': ['STORE'],
  'Logo Design': ['LOGO_DESIGN'],
  'Production': ['PRODUCTION'],
  'Dispatch': ['DISPATCH'],
  'Delivery': ['DELIVERY_BOY'],
  'Outlet': ['OUTLET'],
  'Admin': ['SUPER_ADMIN', 'ADMIN'],
  'Inventory': ['INVENTORY_VIEW']
};

const getEmployees = async (req, res) => {
  try {
    const { role, outletName, isActive, search } = req.query;
    const where = {};
    if (role) where.role = role;
    if (outletName) where.outletName = outletName;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    const employees = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true, outletName: true,
        subRole: true, isActive: true, employeeId: true, createdAt: true
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }]
    });
    res.json(employees);
  } catch (error) {
    console.error('[getEmployees]', error.message);
    res.status(500).json({ message: 'Error fetching employees' });
  }
};

const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, role: true, outletName: true,
        subRole: true, isActive: true, employeeId: true, createdAt: true
      }
    });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (error) {
    console.error('[getEmployeeById]', error.message);
    res.status(500).json({ message: 'Error fetching employee' });
  }
};

const createEmployee = async (req, res) => {
  try {
    const { name, email, password, role, outletName, subRole, employeeId } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required' });
    }
    if (!AVAILABLE_ROLES.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Available: ${AVAILABLE_ROLES.join(', ')}` });
    }
    if (role === 'OUTLET' && subRole && !OUTLET_SUB_ROLES.includes(subRole)) {
      return res.status(400).json({ message: `Invalid subRole. Available: ${OUTLET_SUB_ROLES.join(', ')}` });
    }
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) return res.status(400).json({ message: 'Email already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const employee = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role,
        outletName: outletName || null,
        subRole: subRole || null,
        isActive: true,
        employeeId: employeeId || null
      },
      select: {
        id: true, name: true, email: true, role: true, outletName: true,
        subRole: true, isActive: true, employeeId: true, createdAt: true
      }
    });
    res.status(201).json(employee);
  } catch (error) {
    console.error('[createEmployee]', error.message);
    if (error.code === 'P2002') return res.status(400).json({ message: 'Email already exists' });
    res.status(500).json({ message: 'Error creating employee' });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, outletName, subRole, isActive, employeeId } = req.body;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Employee not found' });
    if (role && !AVAILABLE_ROLES.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Available: ${AVAILABLE_ROLES.join(', ')}` });
    }
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) {
      const normalized = email.toLowerCase().trim();
      if (normalized !== existing.email) {
        const dup = await prisma.user.findUnique({ where: { email: normalized } });
        if (dup) return res.status(400).json({ message: 'Email already exists' });
      }
      updateData.email = normalized;
    }
    if (role !== undefined) updateData.role = role;
    if (outletName !== undefined) updateData.outletName = outletName || null;
    if (subRole !== undefined) updateData.subRole = subRole || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (employeeId !== undefined) updateData.employeeId = employeeId || null;

    const employee = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, name: true, email: true, role: true, outletName: true,
        subRole: true, isActive: true, employeeId: true, createdAt: true
      }
    });
    res.json(employee);
  } catch (error) {
    console.error('[updateEmployee]', error.message);
    if (error.code === 'P2002') return res.status(400).json({ message: 'Email already exists' });
    res.status(500).json({ message: 'Error updating employee' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 4) {
      return res.status(400).json({ message: 'Password must be at least 4 characters' });
    }
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Employee not found' });
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id }, data: { password: hashedPassword } });
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('[resetPassword]', error.message);
    res.status(500).json({ message: 'Error resetting password' });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Employee not found' });
    if (existing.role === 'SUPER_ADMIN') {
      return res.status(400).json({ message: 'Cannot delete Super Admin' });
    }
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Employee deactivated' });
  } catch (error) {
    console.error('[deleteEmployee]', error.message);
    res.status(500).json({ message: 'Error deactivating employee' });
  }
};

const verifyEmployee = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) return res.status(401).json({ message: 'Employee not found' });
    if (!user.isActive) return res.status(401).json({ message: 'Employee is inactive' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Wrong password' });
    res.json({ id: user.id, name: user.name, role: user.role, outletName: user.outletName, subRole: user.subRole });
  } catch (error) {
    console.error('[verifyEmployee]', error.message);
    res.status(500).json({ message: 'Error verifying employee' });
  }
};

const getEmployeesByRole = async (req, res) => {
  try {
    const { role, outletName } = req.query;
    const where = { isActive: true };
    if (role) where.role = role;
    if (outletName) where.outletName = outletName;
    const employees = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, outletName: true, subRole: true },
      orderBy: { name: 'asc' }
    });
    res.json(employees);
  } catch (error) {
    console.error('[getEmployeesByRole]', error.message);
    res.status(500).json({ message: 'Error fetching employees' });
  }
};

const getRoleCounts = async (req, res) => {
  try {
    const roles = AVAILABLE_ROLES;
    const counts = await Promise.all(
      roles.map(role => prisma.user.count({ where: { role, isActive: true } }))
    );
    const result = roles.reduce((acc, role, i) => {
      acc[role] = counts[i];
      return acc;
    }, {});
    res.json(result);
  } catch (error) {
    console.error('[getRoleCounts]', error.message);
    res.status(500).json({ message: 'Error fetching role counts' });
  }
};

module.exports = {
  getEmployees, getEmployeeById, createEmployee, updateEmployee,
  resetPassword, deleteEmployee, verifyEmployee, getEmployeesByRole,
  getRoleCounts, AVAILABLE_ROLES, OUTLET_SUB_ROLES
};
