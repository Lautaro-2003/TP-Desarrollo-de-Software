import { Repository } from "../shared/repository.js";
import { Category } from './category.entity.js'


const categories = [
  new Category(
    'Placas de Video',
    'Tarjetas gráficas para gaming, diseño y renderizado',
    'b13c92cd-4870-5332-cfc2-e8b4bfc8e4ef'
  ),
]

export class CategoryRepository implements Repository<Category> {
  public findAll(): Category[] | undefined {
    return categories
  }

  public findOne(item: { id: string }): Category | undefined {
    return categories.find((category) => category.id === item.id)
  }

  public add(item: Category): Category | undefined {
    categories.push(item)
    return item
  }

  public update(item: Category): Category | undefined {
    const categoryIdx = categories.findIndex((category) => category.id === item.id)
    if (categoryIdx !== -1) {
      categories[categoryIdx] = { ...categories[categoryIdx], ...item }
    }
    return categories[categoryIdx]
  }

  public delete(item: { id: string }): Category | undefined {
    const categoryIdx = categories.findIndex((category) => category.id === item.id)

    if (categoryIdx !== -1) {
      const deletedCategory = categories[categoryIdx]
      categories.splice(categoryIdx, 1)
      return deletedCategory
    }
  }
}