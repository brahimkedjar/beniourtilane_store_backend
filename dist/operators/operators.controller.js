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
exports.OperatorsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const operators_service_1 = require("./operators.service");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const roles_decorator_1 = require("../common/roles.decorator");
const roles_enum_1 = require("../common/roles.enum");
const roles_guard_1 = require("../common/roles.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const update_operator_dto_1 = require("./dto/update-operator.dto");
const set_activation_dto_1 = require("./dto/set-activation.dto");
const set_active_dto_1 = require("./dto/set-active.dto");
const working_hours_dto_1 = require("./dto/working-hours.dto");
const location_dto_1 = require("./dto/location.dto");
let OperatorsController = class OperatorsController {
    constructor(operatorsService) {
        this.operatorsService = operatorsService;
    }
    getProfile(user) {
        return this.operatorsService.getProfile(user.id);
    }
    updateProfile(user, dto) {
        return this.operatorsService.updateProfile(user.id, dto);
    }
    setActivationMode(user, dto) {
        return this.operatorsService.setActivationMode(user.id, dto);
    }
    setActive(user, dto) {
        return this.operatorsService.setActive(user.id, dto.isActive);
    }
    getWorkingHours(user) {
        return this.operatorsService.getWorkingHours(user.id);
    }
    updateWorkingHours(user, dto) {
        return this.operatorsService.updateWorkingHours(user.id, dto.items);
    }
    updateLocation(user, dto) {
        return this.operatorsService.updateLocationForUser(user.id, dto);
    }
    getRatingsSummary(user) {
        return this.operatorsService.getRatingSummary(user.id);
    }
};
exports.OperatorsController = OperatorsController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OperatorsController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Patch)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_operator_dto_1.UpdateOperatorDto]),
    __metadata("design:returntype", void 0)
], OperatorsController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Patch)('activation-mode'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, set_activation_dto_1.SetActivationDto]),
    __metadata("design:returntype", void 0)
], OperatorsController.prototype, "setActivationMode", null);
__decorate([
    (0, common_1.Patch)('active'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, set_active_dto_1.SetActiveDto]),
    __metadata("design:returntype", void 0)
], OperatorsController.prototype, "setActive", null);
__decorate([
    (0, common_1.Get)('working-hours'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OperatorsController.prototype, "getWorkingHours", null);
__decorate([
    (0, common_1.Patch)('working-hours'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, working_hours_dto_1.UpdateWorkingHoursDto]),
    __metadata("design:returntype", void 0)
], OperatorsController.prototype, "updateWorkingHours", null);
__decorate([
    (0, common_1.Post)('location'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, location_dto_1.UpdateLocationDto]),
    __metadata("design:returntype", void 0)
], OperatorsController.prototype, "updateLocation", null);
__decorate([
    (0, common_1.Get)('ratings/summary'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OperatorsController.prototype, "getRatingsSummary", null);
exports.OperatorsController = OperatorsController = __decorate([
    (0, swagger_1.ApiTags)('operator'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(roles_enum_1.UserRole.OPERATOR),
    (0, common_1.Controller)('operator'),
    __metadata("design:paramtypes", [operators_service_1.OperatorsService])
], OperatorsController);
//# sourceMappingURL=operators.controller.js.map