import { pool } from "../config/db.js";

const summaryService = {
  async getSummary(userId, filters = {}) {
    const { start_date, end_date } = filters;
    const conditions = [];
    const params = [userId];

    if (start_date) {
      conditions.push("date >= ?");
      params.push(start_date);
    }
    if (end_date) {
      conditions.push("date <= ?");
      params.push(end_date);
    }

    const dateFilter = conditions.length
      ? "AND " + conditions.join(" AND ")
      : "";

    const [[totals], [breakdown], [monthly]] = await Promise.all([
      pool.execute(
        `SELECT
           COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)                  AS total_income,
           COALESCE(SUM(CASE WHEN type IN ('expense','saving') THEN amount ELSE 0 END), 0)     AS total_expenses,
           COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN type IN ('expense','saving') THEN amount ELSE 0 END), 0)     AS net_balance
         FROM transactions WHERE user_id = ? ${dateFilter}`,
        params,
      ),
      pool.execute(
        `SELECT c.id AS category_id, c.name AS category_name, t.type,
                SUM(t.amount) AS total, COUNT(t.id) AS transaction_count
         FROM transactions t
         JOIN categories c ON t.category_id = c.id
         WHERE t.user_id = ? ${dateFilter}
         GROUP BY c.id, c.name, t.type
         ORDER BY total DESC`,
        params,
      ),
      pool.execute(
        `SELECT DATE_FORMAT(date, '%Y-%m') AS month,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END)                  AS income,
                SUM(CASE WHEN type IN ('expense','saving') THEN amount ELSE 0 END)     AS expenses
         FROM transactions WHERE user_id = ? ${dateFilter}
         GROUP BY DATE_FORMAT(date, '%Y-%m')
         ORDER BY month ASC`,
        params,
      ),
    ]);

    return {
      totals: totals[0],
      categoryBreakdown: breakdown,
      monthlyTrend: monthly,
    };
  },

  async getGoalsOverview(userId) {
    const [rows] = await pool.execute(
      `SELECT g.id, g.title, g.target_amount, g.current_amount, g.is_completed, g.completed_at,
              LEAST(ROUND((g.current_amount / g.target_amount * 100), 2), 100) AS progress_percent,
              GREATEST(g.target_amount - g.current_amount, 0)                  AS remaining_amount,
              COUNT(ga.id)                                                      AS allocation_count,
              MAX(ga.created_at)                                                AS last_allocation_date
       FROM goals g
       LEFT JOIN goal_allocations ga ON g.id = ga.goal_id
       WHERE g.user_id = ?
       GROUP BY g.id, g.title, g.target_amount, g.current_amount, g.is_completed, g.completed_at
       ORDER BY g.is_completed ASC, g.created_at DESC`,
      [userId],
    );

    const active = rows.filter((g) => !g.is_completed);
    const completed = rows.filter((g) => g.is_completed);

    return {
      summary: {
        totalGoals: rows.length,
        activeGoals: active.length,
        completedGoals: completed.length,
        totalTargetAmount: rows.reduce(
          (s, g) => s + parseFloat(g.target_amount),
          0,
        ),
        totalSavedAmount: rows.reduce(
          (s, g) => s + parseFloat(g.current_amount),
          0,
        ),
      },
      goals: { active, completed },
    };
  },
};

export default summaryService;
