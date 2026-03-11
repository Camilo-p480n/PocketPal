// src/controllers/goalController.js
import { goalService } from "../services/goalService.js";

export const getGoals = async (req, res, next) => {
  try {
    const goals = await goalService.list(req.user.id);
    res.json({ success: true, data: { goals } });
  } catch (err) {
    next(err);
  }
};

export const getGoalById = async (req, res, next) => {
  try {
    const data = await goalService.getById(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createGoal = async (req, res, next) => {
  try {
    const goal = await goalService.create(req.user.id, req.body);
    res
      .status(201)
      .json({ success: true, message: "Meta creada", data: { goal } });
  } catch (err) {
    next(err);
  }
};

export const updateGoal = async (req, res, next) => {
  try {
    const goal = await goalService.update(req.params.id, req.user.id, req.body);
    res.json({ success: true, message: "Meta actualizada", data: { goal } });
  } catch (err) {
    next(err);
  }
};

export const deleteGoal = async (req, res, next) => {
  try {
    await goalService.delete(req.params.id, req.user.id);
    res.json({ success: true, message: "Meta eliminada" });
  } catch (err) {
    next(err);
  }
};

// export const allocateToGoal = async (req, res, next) => {
//   try {
//     const result = await goalService.allocate(
//       req.params.id,
//       req.user.id,
//       req.body.amount,
//     );
//     res.status(201).json({
//       success: true,
//       message: result.justCompleted
//         ? "🎉 ¡Meta completada!"
//         : "Abono registrado",
//       data: { goal: result.goal, allocation: result.allocation },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// Esto es para saber que vamos a hacer con el dinero al final cuando se cumpla una meta
// Aporte a una meta

export const addContribution = async (req, res, next) => {
  try {
    const result = await goalService.allocate(
      req.params.goalId,
      req.user.id,
      req.body.amount,
    );

    if (result.justCompleted) {
      return res.json({
        success: true,
        message: "¡Meta completada!",
        data: {
          completed: true,
          goalId: req.params.goalId,
          title: result.goal.title,
          targetAmount: result.goal.target_amount,
        },
      });
    }

    res.json({
      success: true,
      message: "Aporte registrado",
      data: { completed: false, newAmount: result.goal.current_amount },
    });
  } catch (err) {
    next(err);
  }
};


// Decisión final cuando la meta se completa
export const completeGoal = async (req, res, next) => {
  try {
    await goalService.completeGoal(
      req.params.goalId,
      req.user.id,
      req.body.completionType,
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};