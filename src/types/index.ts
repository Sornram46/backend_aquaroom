

declare global {
  namespace Express {
    interface Request {
      files?: any[];
    }
  }
}

export {};

export interface UserInput {
    email: string;
    password: string;
    fullName: string;
    phoneNumber?: string;
    role?: 'USER' | 'ADMIN';
  }
  
  export interface LoginInput {
    email: string;
    password: string;
  }
  
  export interface AddressInput {
    fullName: string;
    phoneNumber: string;
    address: string;
    province: string;
    district: string;
    postalCode: string;
    isDefault?: boolean;
  }
  
  export interface ProductInput {
    name: string;
    description?: string;
    price: number;
    stockQuantity: number;
    imageUrl?: string;
    categoryId?: number;
  }
  
  export interface CategoryInput {
    name: string;
    description?: string;
  }
  
  export interface JwtPayload {
    userId: number;
    email: string;
    role: string;
  }
  
  export interface User {
    id: number;
    email: string;
    name?: string;
    role: string;
    created_at: Date;
    updated_at: Date;
  }
  
  export interface Product {
    id: number;
    name: string;
    description?: string;
    price: number;
    stock: number;
    image_url?: string;
    image_url_two?: string;
    image_url_three?: string;
    image_url_four?: string;
    created_at: Date;
    updated_at: Date;
  }
  
  export interface Category {
    id: number;
    name: string;
    description?: string;
    created_at: Date;
    updated_at: Date;
  }
  
  export interface Order {
    id: number;
    user_id: number;
    order_number: string;
    total_amount: number;
    order_status: string;
    payment_status: string;
    address_id?: number;
    created_at: Date;
    updated_at: Date;
  }
  
  export interface HomepageSetting {
    id: number;
    hero_title?: string;
    hero_subtitle?: string;
    carousel_1_title?: string;
    carousel_1_subtitle?: string;
    carousel_1_image?: string;
    carousel_2_title?: string;
    carousel_2_subtitle?: string;
    carousel_2_image?: string;
    carousel_3_title?: string;
    carousel_3_subtitle?: string;
    carousel_3_image?: string;
    why_choose_title?: string;
    why_choose_subtitle?: string;
    quality_title?: string;
    quality_subtitle?: string;
    quality_feature_1?: string;
    quality_feature_2?: string;
    quality_feature_3?: string;
    created_at: Date;
    updated_at: Date;
  }
  
  export interface AboutSetting {
    id: number;
    hero_title?: string;
    hero_subtitle?: string;
    story_title?: string;
    story_content?: string;
    story_image_url?: string;
    mission_title?: string;
    mission_subtitle?: string;
    mission_1_title?: string;
    mission_1_desc?: string;
    mission_2_title?: string;
    mission_2_desc?: string;
    mission_3_title?: string;
    mission_3_desc?: string;
    team_title?: string;
    team_subtitle?: string;
    team_1_name?: string;
    team_1_role?: string;
    team_1_image?: string;
    team_2_name?: string;
    team_2_role?: string;
    team_2_image?: string;
    team_3_name?: string;
    team_3_role?: string;
    team_3_image?: string;
    team_4_name?: string;
    team_4_role?: string;
    team_4_image?: string;
    values_title?: string;
    values_subtitle?: string;
    value_1_title?: string;
    value_1_desc?: string;
    value_2_title?: string;
    value_2_desc?: string;
    value_3_title?: string;
    value_3_desc?: string;
    value_4_title?: string;
    value_4_desc?: string;
    created_at: Date;
    updated_at: Date;
  }