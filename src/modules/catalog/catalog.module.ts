import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from './schemas/category.schema';
import { Product, ProductSchema } from './schemas/product.schema';
import {
  SynonymDictionary,
  SynonymDictionarySchema,
} from './schemas/synonym-dictionary.schema';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { SynonymService } from './synonym.service';
import { SynonymController } from './synonym.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: Product.name, schema: ProductSchema },
      { name: SynonymDictionary.name, schema: SynonymDictionarySchema },
    ]),
  ],
  controllers: [ProductController, CategoryController, SynonymController],
  providers: [ProductService, CategoryService, SynonymService],
  exports: [MongooseModule, SynonymService],
})
export class CatalogModule {}
