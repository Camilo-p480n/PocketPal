import summaryService from "../services/summaryService.js";

// GET /api/summary
export const getSummary = async (req, res, next) => {
  try {
    const data = await summaryService.getSummary(req.user.id, req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// GET /api/summary/goals
export const getGoalsOverview = async (req, res, next) => {
  try {
    const data = await summaryService.getGoalsOverview(req.user.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};