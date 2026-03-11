// src/controllers/categoryController.js
import { categoryService } from "../services/categoryService.js";

export const getCategories = async (req, res, next) => {
  try {
    const categories = await categoryService.list(req.user.id);
    res.json({ success: true, data: { categories } });
  } catch (err) {
    next(err);
  }
};

export const getCategoryById = async (req, res, next) => {
  try {
    const category = await categoryService.getById(req.params.id, req.user.id);
    res.json({ success: true, data: { category } });
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const category = await categoryService.create(req.user.id, req.body);
    res
      .status(201)
      .json({ success: true, message: "Categoría creada", data: { category } });
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const category = await categoryService.update(
      req.params.id,
      req.user.id,
      req.body,
    );
    res.json({
      success: true,
      message: "Categoría actualizada",
      data: { category },
    });
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    await categoryService.delete(req.params.id, req.user.id);
    res.json({ success: true, message: "Categoría eliminada" });
  } catch (err) {
    next(err);
  }
};
