"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RentalsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const roles_decorator_1 = require("../common/roles.decorator");
const roles_enum_1 = require("../common/roles.enum");
const roles_guard_1 = require("../common/roles.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const rentals_service_1 = require("./rentals.service");
const create_rental_listing_dto_1 = require("./dto/create-rental-listing.dto");
const update_rental_listing_dto_1 = require("./dto/update-rental-listing.dto");
const set_listing_status_dto_1 = require("./dto/set-listing-status.dto");
const create_rental_request_dto_1 = require("./dto/create-rental-request.dto");
const confirm_rental_request_dto_1 = require("./dto/confirm-rental-request.dto");
const create_rental_conversation_dto_1 = require("./dto/create-rental-conversation.dto");
const send_rental_message_dto_1 = require("./dto/send-rental-message.dto");
let RentalsController = class RentalsController {
    constructor(rentalsService) {
        this.rentalsService = rentalsService;
    }
    listListings(user, query) {
        return this.rentalsService.listListings(user, query);
    }
    createListing(user, dto) {
        return this.rentalsService.createListing(user.id, dto);
    }
    updateListing(user, id, dto) {
        return this.rentalsService.updateListing(user.id, id, dto);
    }
    setListingStatus(user, id, dto) {
        return this.rentalsService.setListingStatus(user.id, id, dto.status);
    }
    listRequests(user, query) {
        return this.rentalsService.listRequestsForOperator(user.id, query.status);
    }
    listMyRequests(user) {
        return this.rentalsService.listRequestsForPassenger(user.id);
    }
    createRequest(user, dto) {
        return this.rentalsService.createRequest(user.id, dto);
    }
    confirmRequest(user, id, dto) {
        return this.rentalsService.confirmRequest(user.id, id, dto.listingId);
    }
    rejectRequest(user, id) {
        return this.rentalsService.rejectRequest(user.id, id);
    }
    cancelRequest(user, id) {
        return this.rentalsService.cancelRequest(user.id, id);
    }
    listConversations(user) {
        return this.rentalsService.listConversations(user);
    }
    createConversation(user, dto) {
        return this.rentalsService.createConversation(user, dto);
    }
    getMessages(user, id) {
        return this.rentalsService.getMessages(user, id);
    }
    sendMessage(user, id, dto) {
        return this.rentalsService.sendMessage(user, id, dto.message);
    }
};
exports.RentalsController = RentalsController;
__decorate([
    (0, common_1.Get)('listings'),
    (0, roles_decorator_1.Roles)(roles_enum_1.UserRole.PASSENGER, roles_enum_1.UserRole.OPERATOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], RentalsController.prototype, "listListings", null);
__decorate([
    (0, common_1.Post)('listings'),
    (0, roles_decorator_1.Roles)(roles_enum_1.UserRole.OPERATOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_rental_listing_dto_1.CreateRentalListingDto]),
    __metadata("design:returntype", void 0)
], RentalsController.prototype, "createListing", null);
__decorate([
    (0, common_1.Patch)('listings/:id'),
    (0, roles_decorator_1.Roles)(roles_enum_1.UserRole.OPERATOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_rental_listing_dto_1.UpdateRentalListingDto]),
    __metadata("design:returntype", void 0)
], RentalsController.prototype, "updateListing", null);
__decorate([
    (0, common_1.Patch)('listings/:id/status'),
    (0, roles_decorator_1.Roles)(roles_enum_1.UserRole.OPERATOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, set_listing_status_dto_1.SetRentalListingStatusDto]),
    __metadata("design:returntype", void 0)
], RentalsController.prototype, "setListingStatus", null);
__decorate([
    (0, common_1.Get)('requests'),
    (0, roles_decorator_1.Roles)(roles_enum_1.UserRole.OPERATOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], RentalsController.prototype, "listRequests", null);
__decorate([
    (0, common_1.Get)('requests/mine'),
    (0, roles_decorator_1.Roles)(roles_enum_1.UserRole.PASSENGER),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RentalsController.prototype, "listMyRequests", null);
__decorate([
    (0, common_1.Post)('requests'),
    (0, roles_decorator_1.Roles)(roles_enum_1.UserRole.PASSENGER),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_rental_request_dto_1.CreateRentalRequestDto]),
    __metadata("design:returntype", void 0)
], RentalsController.prototype, "createRequest", null);
__decorate([
    (0, common_1.Post)('requests/:id/confirm'),
    (0, roles_decorator_1.Roles)(roles_enum_1.UserRole.OPERATOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, confirm_rental_request_dto_1.ConfirmRentalRequestDto]),
    __metadata("design:returntype", void 0)
], RentalsController.prototype, "confirmRequest", null);
__decorate([
    (0, common_1.Patch)('requests/:id/reject'),
    (0, roles_decorator_1.Roles)(roles_enum_1.UserRole.OPERATOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RentalsController.prototype, "rejectRequest", null);
__decorate([
    (0, common_1.Patch)('requests/:id/cancel'),
    (0, roles_decorator_1.Roles)(roles_enum_1.UserRole.PASSENGER),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RentalsController.prototype, "cancelRequest", null);
__decorate([
    (0, common_1.Get)('conversations'),
    (0, roles_decorator_1.Roles)(roles_enum_1.UserRole.PASSENGER, roles_enum_1.UserRole.OPERATOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RentalsController.prototype, "listConversations", null);
__decorate([
    (0, common_1.Post)('conversations'),
    (0, roles_decorator_1.Roles)(roles_enum_1.UserRole.PASSENGER, roles_enum_1.UserRole.OPERATOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_rental_conversation_dto_1.CreateRentalConversationDto]),
    __metadata("design:returntype", void 0)
], RentalsController.prototype, "createConversation", null);
__decorate([
    (0, common_1.Get)('conversations/:id/messages'),
    (0, roles_decorator_1.Roles)(roles_enum_1.UserRole.PASSENGER, roles_enum_1.UserRole.OPERATOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RentalsController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)('conversations/:id/messages'),
    (0, roles_decorator_1.Roles)(roles_enum_1.UserRole.PASSENGER, roles_enum_1.UserRole.OPERATOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, send_rental_message_dto_1.SendRentalMessageDto]),
    __metadata("design:returntype", void 0)
], RentalsController.prototype, "sendMessage", null);
exports.RentalsController = RentalsController = __decorate([
    (0, swagger_1.ApiTags)('rentals'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('rentals'),
    __metadata("design:paramtypes", [rentals_service_1.RentalsService])
], RentalsController);
//# sourceMappingURL=rentals.controller.js.map