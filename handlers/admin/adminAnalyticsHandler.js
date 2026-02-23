const {
  fetchRecentActivities,
  fetchSystemAnalytics,
  fetchRecentTransactions,
  fetchRecentUsers,
} = require("../../services/admin/adminAnalyticsService");

const getRecentActivities = async (req, res, next) => {
  try {
    const activities = await fetchRecentActivities();
    res.status(200).json({
      message: `Activites fetched successfully`,
      success: true,
      data: activities,
    });
  } catch (error) {
    next(error);
  }
};

const getSystemAnalytics = async (req, res, next) => {
  try {
    const sysInfo = await fetchSystemAnalytics();
    res.status(200).json({
      message: `Analytics fetched successfully`,
      success: true,
      data: sysInfo,
    });
  } catch (error) {
    next(error);
  }
};

const getRecentTransacts = async (req, res, next) => {
  try {
    const transactions = await fetchRecentTransactions();
    res.status(200).json({
      message: `Recent transactions fetched successfully`,
      success: true,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

const getRecentUsers = async (req, res, next) => {
  try {
    const newusers = await fetchRecentUsers();
    res.status(200).json({
      message: `Recent users fetched successfully`,
      success: true,
      data: newusers,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRecentActivities,
  getRecentTransacts,
  getRecentUsers,
  getSystemAnalytics,
};
