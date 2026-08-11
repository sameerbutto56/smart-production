const prisma = require('../prisma');
const bcrypt = require('bcryptjs');

const PROFILE_OPTIONS = ['POS', 'OUTLET_ORDER_ENTRY', 'DISPATCH', 'FAISAL_PROFILE', 'INVENTORY_VIEW', 'STORE', 'PRODUCTION'];

const normalizeProfiles = (profiles) => {
  if (!Array.isArray(profiles)) return [];
  return [...new Set(profiles.filter(p => PROFILE_OPTIONS.includes(p)))];
};

const getAllEmployees = async (req, res) => {
  try {
    const employees = await prisma.outletEmployee.findMany({
      orderBy: [{ outletName: 'asc' }, { name: 'asc' }],
    });
    res.json({
      employees: employees.map(e => ({
        id: e.id,
        name: e.name,
        outletName: e.outletName,
        profiles: Array.isArray(e.profiles) ? e.profiles : [],
        isActive: e.isActive,
      })),
      profileOptions: PROFILE_OPTIONS,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch employees', error: error.message });
  }
};

const createEmployee = async (req, res) => {
  try {
    const { name, outletName, password, profiles, isActive } = req.body || {};
    const empName = (name || '').toString().trim();
    const empOutlet = (outletName || '').toString().trim();
    const empPass = (password || '').toString();

    if (!empName) return res.status(400).json({ message: 'Employee name is required' });
    if (!empOutlet) return res.status(400).json({ message: 'Outlet is required' });
    if (empPass.length < 4) return res.status(400).json({ message: 'Password must be at least 4 characters' });

    const existing = await prisma.outletEmployee.findUnique({
      where: { name_outletName: { name: empName, outletName: empOutlet } },
    });
    if (existing) {
      return res.status(409).json({ message: `Employee "${empName}" already exists at ${empOutlet}` });
    }

    const employee = await prisma.outletEmployee.create({
      data: {
        name: empName,
        outletName: empOutlet,
        password: await bcrypt.hash(empPass, 10),
        profiles: normalizeProfiles(profiles),
        isActive: isActive !== false,
      },
    });
    res.status(201).json({ ok: true, employee: { id: employee.id, name: employee.name, outletName: employee.outletName, profiles: employee.profiles, isActive: employee.isActive } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create employee', error: error.message });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, outletName, profiles, isActive } = req.body || {};

    const employee = await prisma.outletEmployee.findUnique({ where: { id } });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const data = {};
    if (name !== undefined) data.name = (name || '').toString().trim();
    if (outletName !== undefined) data.outletName = (outletName || '').toString().trim();
    if (profiles !== undefined) data.profiles = normalizeProfiles(profiles);
    if (isActive !== undefined) data.isActive = !!isActive;

    if (data.name && data.outletName) {
      const clash = await prisma.outletEmployee.findUnique({
        where: { name_outletName: { name: data.name, outletName: data.outletName } },
      });
      if (clash && clash.id !== id) {
        return res.status(409).json({ message: `Employee "${data.name}" already exists at ${data.outletName}` });
      }
    }

    const updated = await prisma.outletEmployee.update({ where: { id }, data });
    res.json({ ok: true, employee: { id: updated.id, name: updated.name, outletName: updated.outletName, profiles: updated.profiles, isActive: updated.isActive } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update employee', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body || {};
    const newPass = (password || '').toString();
    if (newPass.length < 4) return res.status(400).json({ message: 'Password must be at least 4 characters' });

    const employee = await prisma.outletEmployee.findUnique({ where: { id } });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    await prisma.outletEmployee.update({ where: { id }, data: { password: await bcrypt.hash(newPass, 10) } });
    res.json({ ok: true, message: `Password reset for ${employee.name}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reset password', error: error.message });
  }
};

const verifyEmployee = async (req, res) => {
  try {
    const { name, password, outlet, profile } = req.body || {};
    const empName = (name || '').toString().trim();
    const empPass = (password || '').toString();

    if (!empName) return res.status(400).json({ message: 'Employee name is required' });
    if (!empPass) return res.status(400).json({ message: 'Password is required' });

    const where = { name: empName, isActive: true };
    const employee = outlet
      ? await prisma.outletEmployee.findFirst({ where: { ...where, outletName: outlet } })
      : await prisma.outletEmployee.findFirst({ where, orderBy: { updatedAt: 'desc' } });

    if (!employee) {
      return res.status(401).json({ message: outlet ? `No employee "${empName}" found at ${outlet}` : `No employee "${empName}" found` });
    }

    if (profile) {
      const profiles = Array.isArray(employee.profiles) ? employee.profiles : [];
      if (!profiles.includes(profile)) {
        return res.status(403).json({ message: `"${empName}" does not have access to this module` });
      }
    }

    const match = await bcrypt.compare(empPass, employee.password);
    if (!match) {
      return res.status(401).json({ message: 'Incorrect password. Please try again.' });
    }

    res.json({
      ok: true,
      employee: {
        id: employee.id,
        name: employee.name,
        outletName: employee.outletName,
        profiles: Array.isArray(employee.profiles) ? employee.profiles : [],
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to verify employee', error: error.message });
  }
};

module.exports = { getAllEmployees, createEmployee, updateEmployee, resetPassword, verifyEmployee, PROFILE_OPTIONS };
